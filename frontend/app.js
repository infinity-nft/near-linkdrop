/**
 * NEAR Linkdrop Claim Frontend
 * =============================
 * Fixed implementation using proper NEAR API
 */

// Configuration
const CONFIG = {
    contractId: 'abhorrent-metal.testnet',
    networkId: 'testnet',
    nodeUrl: '/api/rpc',  // Vercel serverless function
    explorerUrl: 'https://testnet.nearblocks.io',
    walletUrl: 'https://testnet.mynearwallet.com'
};

// State
let state = {
    privateKey: null,
    publicKey: null,
    keyPair: null,
    amount: null,
    currentStep: 1,
    near: null
};

// DOM Elements
const elements = {};

// Initialize after DOM loaded
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('🚀 NEAR Linkdrop Claim initialized');

    // Cache DOM elements
    cacheElements();

    // Set contract ID in footer
    elements.contractId.textContent = CONFIG.contractId;

    // Wait for near-api-js to load
    await loadNearApi();

    // Parse URL parameters
    parseUrlParams();

    // Setup event listeners
    setupEventListeners();

    // Check if we have linkdrop data
    if (state.privateKey) {
        await checkLinkdropBalance();
    } else {
        showDemoMode();
    }
}

function cacheElements() {
    elements.step1 = document.getElementById('step1');
    elements.step2 = document.getElementById('step2');
    elements.step3 = document.getElementById('step3');
    elements.step4 = document.getElementById('step4');
    elements.step5 = document.getElementById('step5');
    elements.step6 = document.getElementById('step6');
    elements.amountDisplay = document.getElementById('claimAmount');
    elements.errorMessage = document.getElementById('errorMessage');
    elements.errorDetails = document.getElementById('errorDetails');
    elements.btnClaimExisting = document.getElementById('btnClaimExisting');
    elements.btnCreateNew = document.getElementById('btnCreateNew');
    elements.btnConfirmClaim = document.getElementById('btnConfirmClaim');
    elements.btnCreateAccount = document.getElementById('btnCreateAccount');
    elements.btnDone = document.getElementById('btnDone');
    elements.btnRetry = document.getElementById('btnRetry');
    elements.backBtn1 = document.getElementById('backBtn1');
    elements.backBtn2 = document.getElementById('backBtn2');
    elements.accountIdInput = document.getElementById('accountIdInput');
    elements.newAccountInput = document.getElementById('newAccountInput');
    elements.accountHint = document.getElementById('accountHint');
    elements.newAccountHint = document.getElementById('newAccountHint');
    elements.processingStatus = document.getElementById('processingStatus');
    elements.successAmount = document.getElementById('successAmount');
    elements.successAccount = document.getElementById('successAccount');
    elements.txLink = document.getElementById('txLink');
    elements.contractId = document.getElementById('contractId');
    elements.confettiCanvas = document.getElementById('confettiCanvas');
}

function loadNearApi() {
    return new Promise((resolve, reject) => {
        if (window.nearApi) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/near-api-js@3.0.4/dist/near-api-js.min.js';
        script.onload = () => {
            console.log('✅ near-api-js loaded');
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);

    // Check for private key in URL (format: ?key=ed25519:...)
    let key = urlParams.get('key') || urlParams.get('secretKey') || urlParams.get('pk');

    // Check for hash-based key (format: #ed25519:...)
    if (!key && window.location.hash) {
        const hashKey = window.location.hash.slice(1);
        if (hashKey.startsWith('ed25519:')) {
            key = hashKey;
        }
    }

    if (key) {
        try {
            state.keyPair = nearApi.KeyPair.fromString(key);
            state.privateKey = key;
            state.publicKey = state.keyPair.getPublicKey().toString();
            console.log('📝 Linkdrop key found:', state.publicKey);
        } catch (e) {
            console.error('Invalid key format:', e);
            showError('Invalid linkdrop key format');
        }
    }
}

function setupEventListeners() {
    elements.btnClaimExisting?.addEventListener('click', () => showStep(2));
    elements.btnCreateNew?.addEventListener('click', () => showStep(3));
    elements.backBtn1?.addEventListener('click', () => showStep(1));
    elements.backBtn2?.addEventListener('click', () => showStep(1));
    elements.btnConfirmClaim?.addEventListener('click', handleClaimToExisting);
    elements.btnCreateAccount?.addEventListener('click', handleCreateAndClaim);
    elements.btnDone?.addEventListener('click', () => {
        // Redirect to wallet with the claimed account
        const account = state.claimedAccount || '';
        window.location.href = `${CONFIG.walletUrl}${account ? '?account=' + account : ''}`;
    });
    elements.btnRetry?.addEventListener('click', () => showStep(1));
    elements.accountIdInput?.addEventListener('input', validateAccountId);
    elements.newAccountInput?.addEventListener('input', validateNewAccountId);
}

function showStep(stepNumber) {
    document.querySelectorAll('.card-section').forEach(section => {
        section.classList.remove('active');
    });

    const step = document.getElementById(`step${stepNumber}`);
    if (step) {
        step.classList.add('active');
        state.currentStep = stepNumber;
    }
}

function showDemoMode() {
    state.amount = '0.5';
    elements.amountDisplay.textContent = '0.5';
    showInfo('Demo Mode: Add ?key=ed25519:YOUR_PRIVATE_KEY to URL to claim real linkdrop');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.borderColor = 'rgba(255, 92, 92, 0.3)';
    elements.errorMessage.style.background = 'rgba(255, 92, 92, 0.1)';
    elements.errorMessage.style.color = '#FF5C5C';
    elements.errorMessage.classList.add('visible');
    setTimeout(() => elements.errorMessage.classList.remove('visible'), 8000);
}

function showInfo(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.borderColor = 'rgba(0, 195, 255, 0.3)';
    elements.errorMessage.style.background = 'rgba(0, 195, 255, 0.1)';
    elements.errorMessage.style.color = '#00C3FF';
    elements.errorMessage.classList.add('visible');
}

async function checkLinkdropBalance() {
    try {
        showStep(4);
        updateProcessingStatus('Checking linkdrop balance...');

        // Query the contract for key balance using RPC
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
                    args_base64: btoa(JSON.stringify({ key: state.publicKey }))
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            const errorMsg = data.error.cause?.info?.error_message || data.error.message || 'Key not found';
            throw new Error(errorMsg);
        }

        if (!data.result || !data.result.result) {
            throw new Error('Invalid response from contract');
        }

        // Parse the result
        const resultBytes = new Uint8Array(data.result.result);
        const resultStr = new TextDecoder().decode(resultBytes);

        // The result is a quoted string like "1000000000000000000000000"
        const balanceYocto = JSON.parse(resultStr);

        // Convert yoctoNEAR to NEAR
        state.amount = formatNear(balanceYocto);
        elements.amountDisplay.textContent = state.amount;

        showStep(1);
        console.log(`✅ Linkdrop balance: ${state.amount} NEAR`);

    } catch (error) {
        console.error('Error checking balance:', error);
        showStep(1);

        if (error.message.includes('Key is missing') || error.message.includes('not found')) {
            showError('Linkdrop not found or already claimed');
        } else {
            showError(`Error: ${error.message}`);
        }
        elements.amountDisplay.textContent = '—';
    }
}

function formatNear(yoctoNear) {
    // yoctoNEAR is 10^24, NEAR is the base unit
    const yocto = BigInt(yoctoNear);
    const near = Number(yocto) / 1e24;
    return near.toFixed(4);
}

function validateAccountId() {
    const value = elements.accountIdInput.value.trim().toLowerCase();
    const hint = elements.accountHint;

    if (!value) {
        hint.textContent = 'Enter your existing NEAR account';
        hint.className = 'input-hint';
        return false;
    }

    const isValid = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(value) && value.length >= 2;

    if (isValid) {
        hint.textContent = '✓ Valid account format';
        hint.className = 'input-hint success';
        return true;
    } else {
        hint.textContent = 'Invalid format. Use letters, numbers, hyphens.';
        hint.className = 'input-hint error';
        return false;
    }
}

function validateNewAccountId() {
    const value = elements.newAccountInput.value.trim().toLowerCase();
    const hint = elements.newAccountHint;

    if (!value) {
        hint.textContent = 'Letters, numbers, and hyphens only';
        hint.className = 'input-hint';
        return false;
    }

    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value) || value.length < 2) {
        hint.textContent = 'Invalid format';
        hint.className = 'input-hint error';
        return false;
    }

    if (value.length < 2 || value.length > 64) {
        hint.textContent = 'Must be 2-64 characters';
        hint.className = 'input-hint error';
        return false;
    }

    hint.textContent = `✓ ${value}.testnet will be created`;
    hint.className = 'input-hint success';
    return true;
}

async function handleClaimToExisting() {
    let accountId = elements.accountIdInput.value.trim().toLowerCase();

    if (!accountId.includes('.')) {
        accountId += '.testnet';
    }

    if (!validateAccountId()) {
        showError('Please enter a valid account ID');
        return;
    }

    if (!state.keyPair) {
        showError('No linkdrop key found. Add ?key=ed25519:... to URL');
        return;
    }

    try {
        showStep(4);
        updateProcessingStatus('Connecting to NEAR...');

        const result = await executeClaimTransaction(accountId);
        showSuccess(accountId, result.transaction.hash);

    } catch (error) {
        console.error('Claim error:', error);
        showFailure(error.message || 'Failed to claim tokens');
    }
}

async function handleCreateAndClaim() {
    let newAccountId = elements.newAccountInput.value.trim().toLowerCase();

    if (!newAccountId.includes('.')) {
        newAccountId += '.testnet';
    }

    if (!validateNewAccountId()) {
        showError('Please enter a valid account name');
        return;
    }

    if (!state.keyPair) {
        showError('No linkdrop key found. Add ?key=ed25519:... to URL');
        return;
    }

    try {
        showStep(4);
        updateProcessingStatus('Generating your keys...');

        // Generate new keypair for the new account
        const newKeyPair = nearApi.KeyPair.fromRandom('ed25519');
        const newPublicKey = newKeyPair.getPublicKey().toString();

        updateProcessingStatus('Creating account...');

        const result = await executeCreateAccountAndClaimTransaction(newAccountId, newPublicKey);

        // Log the private key for the user (in production, show this in UI!)
        console.log('🔐 New account private key (SAVE THIS!):', newKeyPair.toString());

        showSuccess(newAccountId, result.transaction.hash);

    } catch (error) {
        console.error('Create account error:', error);
        showFailure(error.message || 'Failed to create account');
    }
}

async function executeClaimTransaction(accountId) {
    updateProcessingStatus('Setting up connection...');

    // Setup keystore with the linkdrop key
    const keyStore = new nearApi.keyStores.InMemoryKeyStore();
    // The key is for the CONTRACT account, not the receiver
    await keyStore.setKey(CONFIG.networkId, CONFIG.contractId, state.keyPair);

    const near = await nearApi.connect({
        networkId: CONFIG.networkId,
        keyStore: keyStore,
        nodeUrl: CONFIG.nodeUrl
    });

    updateProcessingStatus('Preparing transaction...');

    // Get account object for the contract (we sign with the linkdrop access key)
    const account = await near.account(CONFIG.contractId);

    updateProcessingStatus('Signing and sending...');

    // Call claim method - this transfers funds to accountId
    const result = await account.functionCall({
        contractId: CONFIG.contractId,
        methodName: 'claim',
        args: { account_id: accountId },
        gas: '30000000000000', // 30 TGas
        attachedDeposit: '0'
    });

    updateProcessingStatus('Confirming...');

    return result;
}

async function executeCreateAccountAndClaimTransaction(newAccountId, newPublicKey) {
    updateProcessingStatus('Setting up connection...');

    const keyStore = new nearApi.keyStores.InMemoryKeyStore();
    await keyStore.setKey(CONFIG.networkId, CONFIG.contractId, state.keyPair);

    const near = await nearApi.connect({
        networkId: CONFIG.networkId,
        keyStore: keyStore,
        nodeUrl: CONFIG.nodeUrl
    });

    updateProcessingStatus('Creating account...');

    const account = await near.account(CONFIG.contractId);

    updateProcessingStatus('Signing and sending...');

    // Call create_account_and_claim
    const result = await account.functionCall({
        contractId: CONFIG.contractId,
        methodName: 'create_account_and_claim',
        args: {
            new_account_id: newAccountId,
            new_public_key: newPublicKey
        },
        gas: '100000000000000', // 100 TGas
        attachedDeposit: '0'
    });

    updateProcessingStatus('Finalizing...');

    return result;
}

function updateProcessingStatus(message) {
    if (elements.processingStatus) {
        elements.processingStatus.textContent = message;
    }
}

function showSuccess(accountId, txHash) {
    state.claimedAccount = accountId;
    elements.successAmount.textContent = `${state.amount || '?'} NEAR`;
    elements.successAccount.textContent = accountId;
    elements.txLink.href = `${CONFIG.explorerUrl}/txns/${txHash}`;

    showStep(5);

    // Launch confetti!
    launchConfetti();
}

function showFailure(message) {
    if (elements.errorDetails) {
        elements.errorDetails.textContent = message;
    }
    showStep(6);
}

// Confetti Animation
function launchConfetti() {
    const canvas = elements.confettiCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#00EC97', '#00C3FF', '#FFD700', '#FF6B35', '#6B5CE7', '#FF5C5C'];

    // Create particles
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20 - 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 10 + 5,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            gravity: 0.3,
            decay: 0.98
        });
    }

    let animationFrame;

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let activeParticles = 0;

        particles.forEach(p => {
            p.vy += p.gravity;
            p.vx *= p.decay;
            p.vy *= p.decay;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            if (p.y < canvas.height + 50) {
                activeParticles++;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }
        });

        if (activeParticles > 0) {
            animationFrame = requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    animate();

    // Stop after 5 seconds
    setTimeout(() => {
        cancelAnimationFrame(animationFrame);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 5000);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
