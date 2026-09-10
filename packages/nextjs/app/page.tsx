"use client";

import { useState } from "react";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { encodeAbiParameters, formatEther, parseEther, parseAbi } from "viem";
import {
  useAccount,
  useBalance,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { getTargetNetworks } from "~~/utils/scaffold-eth/networks";

// CCIP addresses on Sepolia testnet
const CCIP_ROUTER_ADDRESS = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";
const LINK_TOKEN_ADDRESS = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

// CCIP destination chain selectors (testnets)
const DESTINATION_CHAINS: Record<string, { selector: bigint; name: string }> = {
  //arbitrumSepolia: { selector: 3478487238524512106n, name: "Arbitrum Sepolia" },
  //optimismSepolia: { selector: 5224473277236331295n, name: "Optimism Sepolia" },
  baseSepolia: { selector: 10344971235874465080n, name: "Base Sepolia" },
  //polygonAmoy: { selector: 16281711391670634445n, name: "Polygon Amoy" },
  //avalancheFuji: { selector: 14767482510784806043n, name: "Avalanche Fuji" },
  //bnbTestnet: { selector: 13264668187771770619n, name: "BNB Chain Testnet" },
};

// CCIP Router ABI (JSON format to avoid nested tuple parsing issues)
const CCIP_ROUTER_ABI = [
  {
    name: "ccipSend",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "destinationChainSelector", type: "uint64" },
      {
        name: "message",
        type: "tuple",
        components: [
          { name: "receiver", type: "bytes" },
          { name: "data", type: "bytes" },
          {
            name: "tokenAmounts",
            type: "tuple[]",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "feeToken", type: "address" },
          { name: "extraArgs", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const Home: NextPage = () => {
  const { address: connectedAddress, chainId } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const targetNetworks = getTargetNetworks();

  // Deposit state
  const [depositAmount, setDepositAmount] = useState("");
  const { data: ethBalance } = useBalance({
    address: connectedAddress,
    chainId: 11155111,
  });

  // Redeem state
  const [redeemAmount, setRedeemAmount] = useState("");

  // Bridge state
  const [bridgeAmount, setBridgeAmount] = useState("");
  const [bridgeDestChain, setBridgeDestChain] = useState("arbitrumSepolia");
  const [bridgeReceiver, setBridgeReceiver] = useState("");

  // Vault contract on Sepolia
  const isOnSepolia = chainId === 11155111;

  // Read user's RebaseToken balance on Sepolia
  const { data: tokenBalance } = useScaffoldReadContract({
    contractName: "RebaseToken",
    functionName: "balanceOf",
    args: [connectedAddress],
    chainId: 11155111,
  });

  // Get RebaseToken address from the Vault (needed for bridging)
  const { data: rebaseTokenAddress } = useScaffoldReadContract({
    contractName: "Vault",
    functionName: "getRebaseTokenAddress",
    chainId: 11155111,
  });

  // Write contract for deposit
  const {
    writeContractAsync,
    data: hash,
    isPending,
    error,
  } = useScaffoldWriteContract({
    contractName: "Vault",
    chainId: 11155111,
  });
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Separate write hook for redeem (keeps deposit/redeem states independent)
  const {
    writeContractAsync: writeRedeemAsync,
    data: redeemHash,
    isPending: isRedeemPending,
    error: redeemError,
  } = useScaffoldWriteContract({
    contractName: "Vault",
    chainId: 11155111,
  });

  const { isLoading: isRedeemConfirming, isSuccess: isRedeemConfirmed } =
    useWaitForTransactionReceipt({
      hash: redeemHash,
    });

  // LINK approval
  const {
    writeContractAsync: approveLink,
    data: approveLinkHash,
    isPending: isLinkApproving,
  } = useWriteContract();
  const { isSuccess: isLinkApproved } = useWaitForTransactionReceipt({
    hash: approveLinkHash,
  });

  // RebaseToken approval (using scaffold hook)
  const {
    writeContractAsync: approveRebaseToken,
    data: approveTokenHash,
    isPending: isTokenApproving,
  } = useScaffoldWriteContract({
    contractName: "RebaseToken",
    chainId: 11155111,
  });
  const { isSuccess: isTokenApproved } = useWaitForTransactionReceipt({
    hash: approveTokenHash,
  });

  // ccipSend call
  const {
    writeContractAsync: ccipSend,
    data: bridgeHash,
    isPending: isBridging,
  } = useWriteContract();
  const { isLoading: isBridgeConfirming, isSuccess: isBridgeConfirmed } =
    useWaitForTransactionReceipt({
      hash: bridgeHash,
    });

  const handleDeposit = () => {
    if (!depositAmount) return;
    writeContractAsync({
      functionName: "deposit",
      value: parseEther(depositAmount),
    });
  };

  const handleRedeem = () => {
    if (!redeemAmount) return;
    writeRedeemAsync({
      functionName: "redeem",
      args: [parseEther(redeemAmount)],
    });
  };

  const handleRedeemMax = () => {
    writeRedeemAsync({
      functionName: "redeem",
      args: [
        BigInt(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ),
      ], // type(uint256).max
    });
  };

  const handleApproveLink = () => {
    approveLink({
      address: LINK_TOKEN_ADDRESS,
      abi: parseAbi([
        "function approve(address spender, uint256 amount) returns (bool)",
      ]),
      functionName: "approve",
      args: [
        CCIP_ROUTER_ADDRESS,
        BigInt(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ),
      ],
    });
  };

  const handleApproveRebaseToken = () => {
    approveRebaseToken({
      functionName: "approve",
      args: [
        CCIP_ROUTER_ADDRESS,
        BigInt(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ),
      ],
    });
  };

  const handleBridge = () => {
    if (!bridgeAmount || !bridgeReceiver) return;
    const tokenAddr = rebaseTokenAddress as string;
    if (!tokenAddr) {
      console.error("RebaseToken address not loaded");
      return;
    }

    const destChain = DESTINATION_CHAINS[bridgeDestChain];
    const encodedReceiver = encodeAbiParameters(
      [{ type: "address" }],
      [bridgeReceiver],
    );

    const message = {
      receiver: encodedReceiver,
      data: "0x",
      tokenAmounts: [
        {
          token: tokenAddr,
          amount: parseEther(bridgeAmount),
        },
      ],
      feeToken: LINK_TOKEN_ADDRESS,
      extraArgs: "0x",
    };

    ccipSend({
      address: CCIP_ROUTER_ADDRESS,
      abi: CCIP_ROUTER_ABI,
      functionName: "ccipSend",
      args: [destChain.selector, message],
    });
  };

  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5">
          <h1 className="text-center">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-4xl font-bold">
              {" "}
              The interplanetary token{" "}
            </span>
          </h1>
          <div className="flex justify-center items-center space-x-2 flex-col">
            <p className="my-2 font-medium">Connected Address:</p>
            <Address address={connectedAddress} chain={targetNetwork} />
          </div>

          {/* Token Info on all networks */}
          {connectedAddress && (
            <div className="mt-8 w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">Your Token Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {targetNetworks.map(network => (
                  <NetworkTokenInfo
                    key={network.id}
                    chainId={network.id}
                    chainName={network.name}
                    userAddress={connectedAddress}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Deposit Section (only on Sepolia) */}
          {connectedAddress && isOnSepolia && (
            <div className="mt-8 w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">
                Deposit ETH to Mint Rebase Tokens
              </h2>
              <div className="card bg-base-200 shadow-xl p-4">
                <p className="mb-2">
                  Your ETH Balance:{" "}
                  {ethBalance ? formatEther(ethBalance.value) : "0"} ETH
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Amount in ETH"
                    className="input input-bordered w-full"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    disabled={isPending || isConfirming}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleDeposit}
                    disabled={!depositAmount || isPending || isConfirming}
                  >
                    {isPending
                      ? "Confirming..."
                      : isConfirming
                        ? "Waiting..."
                        : "Deposit"}
                  </button>
                </div>
                {isConfirmed && (
                  <p className="text-success mt-2">Deposit successful!</p>
                )}
                {error && (
                  <p className="text-error mt-2">Error: {error.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Redeem Section (only on Sepolia) */}
          {connectedAddress && isOnSepolia && (
            <div className="mt-6 w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">
                Redeem Rebase Tokens for ETH
              </h2>
              <div className="card bg-base-200 shadow-xl p-4">
                <p className="mb-2">
                  Your Token Balance:{" "}
                  {tokenBalance ? formatEther(tokenBalance as bigint) : "0"} IPT
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Amount in IPT"
                    className="input input-bordered w-full"
                    value={redeemAmount}
                    onChange={e => setRedeemAmount(e.target.value)}
                    disabled={isRedeemPending || isRedeemConfirming}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={handleRedeemMax}
                    disabled={isRedeemPending || isRedeemConfirming}
                  >
                    MAX
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleRedeem}
                    disabled={
                      !redeemAmount || isRedeemPending || isRedeemConfirming
                    }
                  >
                    {isRedeemPending
                      ? "Confirming..."
                      : isRedeemConfirming
                        ? "Waiting..."
                        : "Redeem"}
                  </button>
                </div>
                {isRedeemConfirmed && (
                  <p className="text-success mt-2">Redeem successful!</p>
                )}
                {redeemError && (
                  <p className="text-error mt-2">
                    Error: {redeemError.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Bridge Section (only on Sepolia) */}
          {connectedAddress && isOnSepolia && (
            <div className="mt-6 w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">
                Bridge Tokens to Another Chain
              </h2>
              <div className="card bg-base-200 shadow-xl p-4">
                {/* Step 1: Approvals */}
                <div className="mb-4">
                  <h3 className="font-medium mb-2">
                    Step 1: Approve Token Spend
                  </h3>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={handleApproveLink}
                      disabled={isLinkApproving || isLinkApproved}
                    >
                      {isLinkApproving
                        ? "Approving..."
                        : isLinkApproved
                          ? "✓ LINK Approved"
                          : "Approve LINK"}
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={handleApproveRebaseToken}
                      disabled={isTokenApproving || isTokenApproved}
                    >
                      {isTokenApproving
                        ? "Approving..."
                        : isTokenApproved
                          ? "✓ IPT Approved"
                          : "Approve IPT"}
                    </button>
                  </div>
                </div>

                {/* Step 2: Bridge */}
                <div>
                  <h3 className="font-medium mb-2">Step 2: Initiate Bridge</h3>
                  <div className="flex flex-col gap-2">
                    <select
                      className="select select-bordered w-full"
                      value={bridgeDestChain}
                      onChange={e => setBridgeDestChain(e.target.value)}
                    >
                      {Object.entries(DESTINATION_CHAINS).map(
                        ([key, chain]) => (
                          <option key={key} value={key}>
                            {chain.name}
                          </option>
                        ),
                      )}
                    </select>
                    <input
                      type="text"
                      placeholder="Receiver address on destination chain"
                      className="input input-bordered w-full"
                      value={bridgeReceiver}
                      onChange={e => setBridgeReceiver(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount in IPT"
                        className="input input-bordered w-full"
                        value={bridgeAmount}
                        onChange={e => setBridgeAmount(e.target.value)}
                        disabled={isBridging || isBridgeConfirming}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={handleBridge}
                        disabled={
                          !bridgeAmount ||
                          !bridgeReceiver ||
                          isBridging ||
                          isBridgeConfirming ||
                          !isLinkApproved ||
                          !isTokenApproved
                        }
                      >
                        {isBridging
                          ? "Confirming..."
                          : isBridgeConfirming
                            ? "Bridging..."
                            : "Bridge"}
                      </button>
                    </div>
                  </div>
                  {isBridgeConfirmed && (
                    <p className="text-success mt-2">
                      Bridge initiated!{" "}
                      <a
                        href={`https://ccip.chain.link/tx/${bridgeHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Track via CCIP Explorer
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

type NetworkTokenInfoProps = {
  chainId: number;
  chainName: string;
  userAddress: string;
};

const NetworkTokenInfo = ({
  chainId,
  chainName,
  userAddress,
}: NetworkTokenInfoProps) => {
  const { data: balance, isLoading: balanceLoading } = useScaffoldReadContract({
    contractName: "RebaseToken",
    functionName: "balanceOf",
    args: [userAddress],
    chainId: chainId as (typeof scaffoldConfig.targetNetworks)[number]["id"],
  });

  const { data: interestRate, isLoading: rateLoading } =
    useScaffoldReadContract({
      contractName: "RebaseToken",
      functionName: "getUserInterestRate",
      args: [userAddress],
      chainId: chainId as (typeof scaffoldConfig.targetNetworks)[number]["id"],
    });

  return (
    <div className="card bg-base-200 shadow-xl p-4">
      <h3 className="text-lg font-bold">{chainName}</h3>
      <div className="mt-2">
        <p>
          <span className="font-medium">Balance:</span>{" "}
          {balanceLoading
            ? "Loading..."
            : balance
              ? formatEther(balance as bigint)
              : "0"}
        </p>
        <p>
          <span className="font-medium">Interest Rate:</span>{" "}
          {rateLoading
            ? "Loading..."
            : interestRate
              ? formatEther(interestRate as bigint)
              : "0"}
        </p>
      </div>
    </div>
  );
};

export default Home;
