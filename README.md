# Dark Pool

Private DEX built on Solana using MagicBlock's Private Ephemeral Rollup (PER) framework.

Orders are placed on-chain, delegated to a TEE-secured ephemeral rollup, and matched privately. Only executed trades are revealed publicly.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Trader    │────▶│   Dark Pool      │────▶│  MagicBlock │
│   (Client)  │     │   (On-chain)     │     │  TEE (TDX)  │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │                       │
                   place_order()              match_orders()
                   delegate_order()           (private execution)
```

## Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_orderbook` | Create market orderbook |
| `place_order` | Submit order (side, amount, price) |
| `create_permission` | Set TEE access permission |
| `delegate_order` | Move order to ephemeral rollup |
| `match_orders` | Execute match in TEE |
| `cancel_order` | Cancel open order |

## Build

```bash
anchor build
```

## Deploy

```bash
# Generate new program keypair
solana-keygen new -o target/deploy/darkpool-keypair.json

# Update program ID in lib.rs and Anchor.toml
anchor keys list

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## TEE Validators

| Region | Endpoint | Validator |
|--------|----------|-----------|
| TEE | tee.magicblock.app | `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA` |
| EU | devnet-eu.magicblock.app | `MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e` |
| US | devnet-us.magicblock.app | `MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd` |

## Flow

1. Trader calls `place_order` → Order PDA created
2. Trader calls `create_permission` → TEE access granted
3. Trader calls `delegate_order` → Order moved to PER
4. TEE calls `match_orders` → Private matching in TDX
5. Trade result revealed on-chain

## Stack

- **Framework**: Anchor 0.30.1+
- **Runtime**: Solana Devnet
- **Privacy**: MagicBlock PER (Intel TDX)

## License

MIT

---

Built by Kairo Shirogane for MagicBlock Hackathon
