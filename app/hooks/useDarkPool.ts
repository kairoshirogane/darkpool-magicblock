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

    const placeOrder = async (
        orderId: number,
        side: { buy: {} } | { sell: {} },
        amount: number,
        price: number
    ) => {
        if (!program || !wallet) throw new Error("Wallet not connected");

        const orderIdBn = new BN(orderId);
        const amountBn = new BN(amount);
        const priceBn = new BN(price);

        const [orderPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("order"), wallet.publicKey.toBuffer(), orderIdBn.toArrayLike(Buffer, "le", 8)],
            PROGRAM_ID
        );

        const [orderbookPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("orderbook"), new PublicKey("11111111111111111111111111111111").toBuffer()],
            PROGRAM_ID
        );

        try {
            const tx = await program.methods
                .placeOrder(orderIdBn, side, amountBn, priceBn)
                .accounts({
                    order: orderPda,
                    orderbook: orderbookPda,
                    owner: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("Order placed:", tx);
            return { tx, orderPda };
        } catch (error) {
            console.error("Error placing order:", error);
            throw error;
        }
    };

    const delegateOrder = async (orderPda: PublicKey, orderId: number) => {
        if (!program || !wallet) throw new Error("Wallet not connected");

        const orderIdBn = new BN(orderId);

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

        try {
            const tx = await program.methods
                .delegateOrder(orderIdBn, new BN(1000000), 1000)
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

            console.log("Order delegated:", tx);
            return tx;
        } catch (error) {
            console.error("Error delegating order:", error);
            throw error;
        }
    };

    return {
        program,
        placeOrder,
        delegateOrder,
    };
};
