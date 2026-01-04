'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  Text,
  Button,
  Input,
  Flex,
  SvgIcon,
  openToast
} from '@near-pagoda/ui';
import { Gift, Wallet, UserPlus, Check, AlertTriangle } from '@phosphor-icons/react';
import { CONFIG } from '@/lib/config';

// Near API - import dynamically to avoid SSR issues
let nearApi: typeof import('near-api-js') | null = null;

interface ClaimState {
  privateKey: string | null;
  publicKey: string | null;
  keyPair: any | null;
  amount: string | null;
  step: 'loading' | 'welcome' | 'claim-existing' | 'claim-new' | 'processing' | 'success' | 'error';
  claimedAccount: string | null;
  txHash: string | null;
  error: string | null;
}

export default function ClaimPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ClaimState>({
    privateKey: null,
    publicKey: null,
    keyPair: null,
    amount: null,
    step: 'loading',
    claimedAccount: null,
    txHash: null,
    error: null
  });
  const [accountId, setAccountId] = useState('');
  const [newAccountId, setNewAccountId] = useState('');

  useEffect(() => {
    async function init() {
      // Load near-api-js
      nearApi = await import('near-api-js');

      // Parse URL params
      const key = searchParams.get('key') || searchParams.get('secretKey');

      if (key) {
        try {
          const keyPair = nearApi.KeyPair.fromString(key);
          const publicKey = keyPair.getPublicKey().toString();

          setState(s => ({ ...s, privateKey: key, publicKey, keyPair }));

          // Check balance
          await checkBalance(publicKey);
        } catch (e) {
          setState(s => ({ ...s, step: 'error', error: 'Invalid linkdrop key' }));
        }
      } else {
        // Demo mode
        setState(s => ({ ...s, step: 'welcome', amount: '0.5' }));
      }
    }

    init();
  }, [searchParams]);

  async function checkBalance(publicKey: string) {
    try {
      const response = await fetch(CONFIG.nodeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'check-balance',
          method: 'query',
          params: {
            request_type: 'call_function',
            finality: 'final',
            account_id: CONFIG.contractId,
            method_name: 'get_key_balance',
            args_base64: btoa(JSON.stringify({ key: publicKey }))
          }
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.cause?.info?.error_message || 'Key not found');
      }

      const resultBytes = new Uint8Array(data.result.result);
      const resultStr = new TextDecoder().decode(resultBytes);
      const balanceYocto = JSON.parse(resultStr);
      const amount = (Number(balanceYocto) / 1e24).toFixed(4);

      setState(s => ({ ...s, amount, step: 'welcome' }));
    } catch (error) {
      setState(s => ({
        ...s,
        step: 'error',
        error: error instanceof Error ? error.message : 'Failed to check balance'
      }));
    }
  }

  async function handleClaimExisting() {
    if (!state.keyPair || !nearApi) return;

    let fullAccountId = accountId.trim().toLowerCase();
    if (!fullAccountId.includes('.')) {
      fullAccountId += '.testnet';
    }

    setState(s => ({ ...s, step: 'processing' }));

    try {
      const keyStore = new nearApi.keyStores.InMemoryKeyStore();
      await keyStore.setKey(CONFIG.networkId, CONFIG.contractId, state.keyPair);

      const near = await nearApi.connect({
        networkId: CONFIG.networkId,
        keyStore,
        nodeUrl: CONFIG.nodeUrl
      });

      const account = await near.account(CONFIG.contractId);

      const result = await account.functionCall({
        contractId: CONFIG.contractId,
        methodName: 'claim',
        args: { account_id: fullAccountId },
        gas: BigInt('30000000000000'),
        attachedDeposit: BigInt('0')
      });

      setState(s => ({
        ...s,
        step: 'success',
        claimedAccount: fullAccountId,
        txHash: result.transaction.hash
      }));

      openToast({
        type: 'success',
        title: 'Tokens Claimed!',
        description: `${state.amount} NEAR sent to ${fullAccountId}`
      });
    } catch (error) {
      setState(s => ({
        ...s,
        step: 'error',
        error: error instanceof Error ? error.message : 'Claim failed'
      }));
    }
  }

  async function handleClaimNew() {
    if (!state.keyPair || !nearApi) return;

    let fullAccountId = newAccountId.trim().toLowerCase();
    if (!fullAccountId.includes('.')) {
      fullAccountId += '.testnet';
    }

    setState(s => ({ ...s, step: 'processing' }));

    try {
      const newKeyPair = nearApi.KeyPair.fromRandom('ed25519');
      const newPublicKey = newKeyPair.getPublicKey().toString();

      const keyStore = new nearApi.keyStores.InMemoryKeyStore();
      await keyStore.setKey(CONFIG.networkId, CONFIG.contractId, state.keyPair);

      const near = await nearApi.connect({
        networkId: CONFIG.networkId,
        keyStore,
        nodeUrl: CONFIG.nodeUrl
      });

      const account = await near.account(CONFIG.contractId);

      const result = await account.functionCall({
        contractId: CONFIG.contractId,
        methodName: 'create_account_and_claim',
        args: {
          new_account_id: fullAccountId,
          new_public_key: newPublicKey
        },
        gas: BigInt('100000000000000'),
        attachedDeposit: BigInt('0')
      });

      console.log('New account private key (SAVE THIS!):', newKeyPair.toString());

      setState(s => ({
        ...s,
        step: 'success',
        claimedAccount: fullAccountId,
        txHash: result.transaction.hash
      }));

      openToast({
        type: 'success',
        title: 'Account Created!',
        description: `${fullAccountId} now has ${state.amount} NEAR`
      });
    } catch (error) {
      setState(s => ({
        ...s,
        step: 'error',
        error: error instanceof Error ? error.message : 'Account creation failed'
      }));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Card className="w-full max-w-md p-8">
        {state.step === 'loading' && (
          <Flex direction="column" align="center" gap="l">
            <Text size="text-l">Loading...</Text>
          </Flex>
        )}

        {state.step === 'welcome' && (
          <Flex direction="column" align="center" gap="l">
            <SvgIcon icon={<Gift />} size="xl" color="green-9" />
            <Text size="text-2xl" weight="bold" color="sand-12">
              You've Received NEAR!
            </Text>
            <Text size="text-l" color="sand-11">
              Someone sent you tokens
            </Text>

            <Card className="w-full bg-green-2 border-green-6 p-4 text-center">
              <Text size="text-s" color="green-11">CLAIMABLE AMOUNT</Text>
              <Text size="text-3xl" weight="bold" color="green-11">
                {state.amount} NEAR
              </Text>
            </Card>

            <Flex direction="column" gap="m" className="w-full">
              <Button
                label="Claim to Existing Account"
                icon={<Wallet />}
                variant="primary"
                size="large"
                fill="outline"
                onClick={() => setState(s => ({ ...s, step: 'claim-existing' }))}
              />
              <Button
                label="Create New Account"
                icon={<UserPlus />}
                variant="secondary"
                size="large"
                fill="outline"
                onClick={() => setState(s => ({ ...s, step: 'claim-new' }))}
              />
            </Flex>
          </Flex>
        )}

        {state.step === 'claim-existing' && (
          <Flex direction="column" gap="l">
            <Button
              label="← Back"
              variant="secondary"
              size="small"
              fill="ghost"
              onClick={() => setState(s => ({ ...s, step: 'welcome' }))}
            />

            <Text size="text-xl" weight="bold">Claim to Existing Account</Text>

            <Input
              label="Account ID"
              placeholder="myaccount"
              assistive=".testnet"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            />

            <Button
              label="Claim Tokens"
              icon={<Check />}
              variant="affirmative"
              size="large"
              onClick={handleClaimExisting}
              disabled={!accountId.trim()}
            />
          </Flex>
        )}

        {state.step === 'claim-new' && (
          <Flex direction="column" gap="l">
            <Button
              label="← Back"
              variant="secondary"
              size="small"
              fill="ghost"
              onClick={() => setState(s => ({ ...s, step: 'welcome' }))}
            />

            <Text size="text-xl" weight="bold">Create New Account</Text>

            <Input
              label="Choose Account Name"
              placeholder="myname"
              assistive=".testnet will be added"
              value={newAccountId}
              onChange={(e) => setNewAccountId(e.target.value)}
            />

            <Button
              label="Create & Claim"
              icon={<UserPlus />}
              variant="affirmative"
              size="large"
              onClick={handleClaimNew}
              disabled={!newAccountId.trim()}
            />
          </Flex>
        )}

        {state.step === 'processing' && (
          <Flex direction="column" align="center" gap="l">
            <div className="animate-spin w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full" />
            <Text size="text-l">Processing transaction...</Text>
          </Flex>
        )}

        {state.step === 'success' && (
          <Flex direction="column" align="center" gap="l">
            <SvgIcon icon={<Check />} size="xl" color="green-9" />
            <Text size="text-2xl" weight="bold" color="green-11">
              Tokens Claimed!
            </Text>

            <Card className="w-full p-4">
              <Flex direction="column" gap="s">
                <Flex justify="space-between">
                  <Text color="sand-10">Amount</Text>
                  <Text weight="bold">{state.amount} NEAR</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="sand-10">To</Text>
                  <Text weight="bold">{state.claimedAccount}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="sand-10">TX</Text>
                  <a
                    href={`${CONFIG.explorerUrl}/txns/${state.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-500 hover:underline"
                  >
                    View →
                  </a>
                </Flex>
              </Flex>
            </Card>

            <Button
              label="🚀 Open My Wallet"
              variant="primary"
              size="large"
              onClick={() => window.location.href = CONFIG.walletUrl}
            />
          </Flex>
        )}

        {state.step === 'error' && (
          <Flex direction="column" align="center" gap="l">
            <SvgIcon icon={<AlertTriangle />} size="xl" color="red-9" />
            <Text size="text-xl" weight="bold" color="red-11">
              Something went wrong
            </Text>
            <Text color="sand-11">{state.error}</Text>
            <Button
              label="Try Again"
              variant="secondary"
              onClick={() => setState(s => ({ ...s, step: 'welcome' }))}
            />
          </Flex>
        )}
      </Card>
    </div>
  );
}
