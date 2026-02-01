import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { Program, Idl, AnchorProvider, setProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../idl/darkpool.json";

const PROGRAM_ID = new PublicKey("7LKw8vSiLfawMNFUSzCoAp9v4GomjTKkhaiXUfmoA6Wu");
const TEE_VALIDATOR = new PublicKey("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");
const DELEGATION_PROGRAM = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

export const useDarkPool = () => {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();

    const provider = useMemo(() => {
        if (!wallet) return null;
        const provider = new AnchorProvider(connection, wallet, {
            preflightCommitment: "confirmed",
        });
        setProvider(provider);
        return provider;
    }, [connection, wallet]);

    const program = useMemo(() => {
        if (!provider) return null;
        return new Program(idl as Idl, provider);
    }, [provider]);

    const getOrderPda = (owner: PublicKey, orderIdBn: BN) =>
        PublicKey.findProgramAddressSync(
            [Buffer.from("order"), owner.toBuffer(), orderIdBn.toArrayLike(Buffer, "le", 8)],
            PROGRAM_ID
        )[0];

    const getOrderbookPda = (market: PublicKey) =>
        PublicKey.findProgramAddressSync([Buffer.from("orderbook"), market.toBuffer()], PROGRAM_ID)[0];

    const initializeOrderbook = async (market: PublicKey) => {
        if (!program || !wallet) throw new Error("Wallet not connected");

        const orderbookPda = getOrderbookPda(market);

        const tx = await program.methods
            .initializeOrderbook(market)
            .accounts({
                orderbook: orderbookPda,
                authority: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return { tx, orderbookPda };
    };

    const placeOrder = async (
        orderId: number,
        side: { buy: {} } | { sell: {} },
        amount: number,
        price: number,
        market: PublicKey
    ) => {
        if (!program || !wallet) throw new Error("Wallet not connected");

        const orderIdBn = new BN(orderId);
        const amountBn = new BN(amount);
        const priceBn = new BN(price);

        const orderPda = getOrderPda(wallet.publicKey, orderIdBn);
        const orderbookPda = getOrderbookPda(market);

        const tx = await program.methods
            .placeOrder(orderIdBn, side, amountBn, priceBn)
            .accounts({
                order: orderPda,
                orderbook: orderbookPda,
                owner: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return { tx, orderPda };
    };

    const delegateOrder = async (
        orderPda: PublicKey,
        orderId: number,
        validUntil: number,
        commitFreqMs: number
    ) => {
        if (!program || !wallet) throw new Error("Wallet not connected");

        const orderIdBn = new BN(orderId);
        const validUntilBn = new BN(validUntil);

        // PDAs for MagicBlock Delegation
        const [delegationBuffer] = PublicKey.findProgramAddressSync(
            [Buffer.from("buffer"), orderPda.toBuffer()],
            DELEGATION_PROGRAM
        );

        const [delegationRecord] = PublicKey.findProgramAddressSync(
            [Buffer.from("record"), orderPda.toBuffer()],
            DELEGATION_PROGRAM
        );

        const [delegationMetadata] = PublicKey.findProgramAddressSync(
            [Buffer.from("metadata"), orderPda.toBuffer()],
            DELEGATION_PROGRAM
        );

        const tx = await program.methods
            .delegateOrder(orderIdBn, validUntilBn, commitFreqMs)
            .accounts({
                order: orderPda,
                owner: wallet.publicKey,
                delegationBuffer,
                delegationRecord,
                delegationMetadata,
                delegationProgram: DELEGATION_PROGRAM,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return tx;
    };

    const cancelOrder = async (orderId: number) => {
        if (!program || !wallet) throw new Error("Wallet not connected");

        const orderIdBn = new BN(orderId);
        const orderPda = getOrderPda(wallet.publicKey, orderIdBn);

        const tx = await program.methods
            .cancelOrder(orderIdBn)
            .accounts({
                order: orderPda,
                owner: wallet.publicKey,
            })
            .rpc();

        return tx;
    };

    const pauseMarket = async (market: PublicKey) => {
        if (!program || !wallet) throw new Error("Wallet not connected");

        const orderbookPda = getOrderbookPda(market);

        const tx = await program.methods
            .pauseMarket()
            .accounts({
                orderbook: orderbookPda,
                authority: wallet.publicKey,
            })
            .rpc();

        return tx;
    };

    const resumeMarket = async (market: PublicKey) => {
        if (!program || !wallet) throw new Error("Wallet not connected");

        const orderbookPda = getOrderbookPda(market);

        const tx = await program.methods
            .resumeMarket()
            .accounts({
                orderbook: orderbookPda,
                authority: wallet.publicKey,
            })
            .rpc();

        return tx;
    };

    const matchOrders = async (
        market: PublicKey,
        tradeId: number,
        buyOrder: PublicKey,
        sellOrder: PublicKey
    ) => {
        if (!program || !wallet) throw new Error("Wallet not connected");

        const tradeIdBn = new BN(tradeId);
        const orderbookPda = getOrderbookPda(market);
        const [tradeResultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("trade"), tradeIdBn.toArrayLike(Buffer, "le", 8)],
            PROGRAM_ID
        );

        const tx = await program.methods
            .matchOrders(tradeIdBn)
            .accounts({
                tradeResult: tradeResultPda,
                buyOrder,
                sellOrder,
                orderbook: orderbookPda,
                matcher: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return tx;
    };

    return {
        program,
        initializeOrderbook,
        placeOrder,
        delegateOrder,
        cancelOrder,
        pauseMarket,
        resumeMarket,
        matchOrders,
    };
};
