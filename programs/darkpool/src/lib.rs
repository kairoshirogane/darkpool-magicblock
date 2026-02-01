use anchor_lang::prelude::*;

declare_id!("7LKw8vSiLfawMNFUSzCoAp9v4GomjTKkhaiXUfmoA6Wu");

pub const ORDER_SEED: &[u8] = b"order";
pub const ORDERBOOK_SEED: &[u8] = b"orderbook";
pub const TRADE_SEED: &[u8] = b"trade";

pub const TEE_VALIDATOR: Pubkey = pubkey!("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");
pub const DELEGATION_PROGRAM: Pubkey = pubkey!("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

#[program]
pub mod darkpool {
    use super::*;

    pub fn initialize_orderbook(ctx: Context<InitializeOrderbook>, market: Pubkey) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook;
        orderbook.market = market;
        orderbook.authority = ctx.accounts.authority.key();
        orderbook.order_count = 0;
        orderbook.trade_count = 0;
        orderbook.is_paused = false;
        orderbook.bump = ctx.bumps.orderbook;
        Ok(())
    }

    pub fn place_order(
        ctx: Context<PlaceOrder>,
        order_id: u64,
        side: OrderSide,
        amount: u64,
        price: u64,
    ) -> Result<()> {
        require!(amount > 0, DarkPoolError::InvalidAmount);
        require!(price > 0, DarkPoolError::InvalidPrice);
        require!(!ctx.accounts.orderbook.is_paused, DarkPoolError::MarketPaused);

        let order = &mut ctx.accounts.order;
        order.owner = ctx.accounts.owner.key();
        order.order_id = order_id;
        order.side = side;
        order.amount = amount;
        order.price = price;
        order.filled_amount = 0;
        order.status = OrderStatus::Open;
        order.created_at = Clock::get()?.unix_timestamp;
        order.bump = ctx.bumps.order;

        ctx.accounts.orderbook.order_count = ctx.accounts.orderbook.order_count.saturating_add(1);

        emit!(OrderPlaced {
            order_id,
            owner: order.owner,
            side,
            amount,
            price,
        });

        Ok(())
    }

    pub fn delegate_order(
        ctx: Context<DelegateOrder>,
        _order_id: u64,
        valid_until: i64,
        commit_freq_ms: u32,
    ) -> Result<()> {
        require!(ctx.accounts.order.status == OrderStatus::Open, DarkPoolError::OrderAlreadyFilled);

        let ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: DELEGATION_PROGRAM,
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.owner.key(), true),
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.order.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(crate::ID, false),
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.delegation_buffer.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.delegation_record.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.delegation_metadata.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
            ],
            data: build_delegate_ix_data(TEE_VALIDATOR, valid_until, commit_freq_ms),
        };

        let owner_key = ctx.accounts.owner.key();
        let order_seeds: &[&[u8]] = &[
            ORDER_SEED,
            owner_key.as_ref(),
            &ctx.accounts.order.order_id.to_le_bytes(),
            &[ctx.accounts.order.bump],
        ];

        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.order.to_account_info(),
                ctx.accounts.delegation_buffer.to_account_info(),
                ctx.accounts.delegation_record.to_account_info(),
                ctx.accounts.delegation_metadata.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[order_seeds],
        ).map_err(anchor_lang::error::Error::from)?;

        ctx.accounts.order.status = OrderStatus::Delegated;

        emit!(OrderDelegated {
            order_id: ctx.accounts.order.order_id,
            tee_validator: TEE_VALIDATOR,
        });

        Ok(())
    }

    pub fn match_orders(ctx: Context<MatchOrders>, trade_id: u64) -> Result<()> {
        let buy_order = &ctx.accounts.buy_order;
        let sell_order = &ctx.accounts.sell_order;

        require!(buy_order.side == OrderSide::Buy, DarkPoolError::InvalidSide);
        require!(sell_order.side == OrderSide::Sell, DarkPoolError::InvalidSide);
        require!(buy_order.status == OrderStatus::Delegated, DarkPoolError::OrderNotDelegated);
        require!(sell_order.status == OrderStatus::Delegated, DarkPoolError::OrderNotDelegated);
        require!(buy_order.price >= sell_order.price, DarkPoolError::PriceMismatch);

        let buy_remaining = buy_order.amount.saturating_sub(buy_order.filled_amount);
        let sell_remaining = sell_order.amount.saturating_sub(sell_order.filled_amount);
        let match_amount = buy_remaining.min(sell_remaining);

        require!(match_amount > 0, DarkPoolError::NoMatchableAmount);

        let execution_price = (buy_order.price + sell_order.price) / 2;

        let trade = &mut ctx.accounts.trade_result;
        trade.trade_id = trade_id;
        trade.buyer = buy_order.owner;
        trade.seller = sell_order.owner;
        trade.amount = match_amount;
        trade.price = execution_price;
        trade.executed_at = Clock::get()?.unix_timestamp;
        trade.bump = ctx.bumps.trade_result;

        let buy_order = &mut ctx.accounts.buy_order;
        buy_order.filled_amount = buy_order.filled_amount.saturating_add(match_amount);
        buy_order.status = if buy_order.filled_amount >= buy_order.amount {
            OrderStatus::Filled
        } else {
            OrderStatus::PartialFill
        };

        let sell_order = &mut ctx.accounts.sell_order;
        sell_order.filled_amount = sell_order.filled_amount.saturating_add(match_amount);
        sell_order.status = if sell_order.filled_amount >= sell_order.amount {
            OrderStatus::Filled
        } else {
            OrderStatus::PartialFill
        };

        ctx.accounts.orderbook.trade_count = ctx.accounts.orderbook.trade_count.saturating_add(1);

        emit!(TradeExecuted {
            trade_id,
            buyer: trade.buyer,
            seller: trade.seller,
            amount: match_amount,
            price: execution_price,
        });

        Ok(())
    }

    pub fn cancel_order(ctx: Context<CancelOrder>, _order_id: u64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(
            order.status == OrderStatus::Open || order.status == OrderStatus::PartialFill,
            DarkPoolError::OrderAlreadyFilled
        );

        order.status = OrderStatus::Cancelled;

        emit!(OrderCancelled {
            order_id: order.order_id,
            owner: order.owner,
        });

        Ok(())
    }

    pub fn pause_market(ctx: Context<MarketControl>) -> Result<()> {
        ctx.accounts.orderbook.is_paused = true;
        Ok(())
    }

    pub fn resume_market(ctx: Context<MarketControl>) -> Result<()> {
        ctx.accounts.orderbook.is_paused = false;
        Ok(())
    }
}

fn build_delegate_ix_data(validator: Pubkey, valid_until: i64, commit_freq_ms: u32) -> Vec<u8> {
    let mut data = vec![0u8; 8 + 32 + 8 + 4];
    data[0..8].copy_from_slice(&[0x44, 0x65, 0x6c, 0x65, 0x67, 0x61, 0x74, 0x65]); // "Delegate"
    data[8..40].copy_from_slice(&validator.to_bytes());
    data[40..48].copy_from_slice(&valid_until.to_le_bytes());
    data[48..52].copy_from_slice(&commit_freq_ms.to_le_bytes());
    data
}

#[derive(Accounts)]
#[instruction(market: Pubkey)]
pub struct InitializeOrderbook<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Orderbook::LEN,
        seeds = [ORDERBOOK_SEED, market.as_ref()],
        bump
    )]
    pub orderbook: Account<'info, Orderbook>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct PlaceOrder<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Order::LEN,
        seeds = [ORDER_SEED, owner.key().as_ref(), &order_id.to_le_bytes()],
        bump
    )]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub orderbook: Account<'info, Orderbook>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct DelegateOrder<'info> {
    #[account(
        mut,
        seeds = [ORDER_SEED, owner.key().as_ref(), &order_id.to_le_bytes()],
        bump = order.bump
    )]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Delegation buffer PDA
    #[account(mut)]
    pub delegation_buffer: UncheckedAccount<'info>,
    /// CHECK: Delegation record PDA
    #[account(mut)]
    pub delegation_record: UncheckedAccount<'info>,
    /// CHECK: Delegation metadata PDA
    #[account(mut)]
    pub delegation_metadata: UncheckedAccount<'info>,
    /// CHECK: MagicBlock Delegation Program
    #[account(address = DELEGATION_PROGRAM)]
    pub delegation_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct MatchOrders<'info> {
    #[account(
        init,
        payer = matcher,
        space = 8 + TradeResult::LEN,
        seeds = [TRADE_SEED, &trade_id.to_le_bytes()],
        bump
    )]
    pub trade_result: Account<'info, TradeResult>,
    #[account(mut)]
    pub buy_order: Account<'info, Order>,
    #[account(mut)]
    pub sell_order: Account<'info, Order>,
    #[account(mut)]
    pub orderbook: Account<'info, Orderbook>,
    #[account(mut)]
    pub matcher: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct CancelOrder<'info> {
    #[account(
        mut,
        seeds = [ORDER_SEED, owner.key().as_ref(), &order_id.to_le_bytes()],
        bump = order.bump,
        constraint = order.owner == owner.key() @ DarkPoolError::Unauthorized
    )]
    pub order: Account<'info, Order>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct MarketControl<'info> {
    #[account(
        mut,
        constraint = orderbook.authority == authority.key() @ DarkPoolError::Unauthorized
    )]
    pub orderbook: Account<'info, Orderbook>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Orderbook {
    pub market: Pubkey,
    pub authority: Pubkey,
    pub order_count: u64,
    pub trade_count: u64,
    pub is_paused: bool,
    pub bump: u8,
}

impl Orderbook {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1 + 1;
}

#[account]
pub struct Order {
    pub owner: Pubkey,
    pub order_id: u64,
    pub side: OrderSide,
    pub amount: u64,
    pub price: u64,
    pub filled_amount: u64,
    pub status: OrderStatus,
    pub created_at: i64,
    pub bump: u8,
}

impl Order {
    pub const LEN: usize = 32 + 8 + 1 + 8 + 8 + 8 + 1 + 8 + 1;
}

#[account]
pub struct TradeResult {
    pub trade_id: u64,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub price: u64,
    pub executed_at: i64,
    pub bump: u8,
}

impl TradeResult {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OrderStatus {
    Open,
    Delegated,
    PartialFill,
    Filled,
    Cancelled,
}

#[event]
pub struct OrderPlaced {
    pub order_id: u64,
    pub owner: Pubkey,
    pub side: OrderSide,
    pub amount: u64,
    pub price: u64,
}

#[event]
pub struct OrderDelegated {
    pub order_id: u64,
    pub tee_validator: Pubkey,
}

#[event]
pub struct TradeExecuted {
    pub trade_id: u64,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub price: u64,
}

#[event]
pub struct OrderCancelled {
    pub order_id: u64,
    pub owner: Pubkey,
}

#[error_code]
pub enum DarkPoolError {
    #[msg("Invalid order side")]
    InvalidSide,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Order already filled or cancelled")]
    OrderAlreadyFilled,
    #[msg("Order not found")]
    OrderNotFound,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Market paused")]
    MarketPaused,
    #[msg("Order must be delegated to TEE")]
    OrderNotDelegated,
    #[msg("Buy price must be >= sell price")]
    PriceMismatch,
    #[msg("No matchable amount")]
    NoMatchableAmount,
}
