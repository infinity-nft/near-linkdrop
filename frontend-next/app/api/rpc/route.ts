import { NextResponse } from 'next/server';

const NEAR_RPC = 'https://rpc.testnet.near.org';

export async function POST(request: Request) {
    try {
        const body = await request.text();

        const rpcResponse = await fetch(NEAR_RPC, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: body,
        });

        const data = await rpcResponse.text();

        return new NextResponse(data, {
            status: rpcResponse.status,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
