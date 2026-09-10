"use client";

import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useBalance, useWaitForTransactionReceipt } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import { useScaffoldReadContract, useScaffoldWriteContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { getTargetNetworks } from "~~/utils/scaffold-eth/networks";

const Home: NextPage = () => {
  const { address: connectedAddress, chainId } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const targetNetworks = getTargetNetworks();

  // Deposit state
  const [depositAmount, setDepositAmount] = useState("");
  const { data: ethBalance } = useBalance({ address: connectedAddress, chainId: 11155111 });

  // Vault contract on Sepolia
  const isOnSepolia = chainId === 11155111;

  // Write contract for deposit
  const { writeContractAsync, data: hash, isPending, error } = useScaffoldWriteContract({
    contractName: "Vault",
    chainId: 11155111,
  });
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleDeposit = () => {
    if (!depositAmount) return;
    writeContractAsync({
      functionName: "deposit",
      value: parseEther(depositAmount),
    });
  };

  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5">
          <h1 className="text-center">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-4xl font-bold"> The interplanetary token </span>
          </h1>
          <div className="flex justify-center items-center space-x-2 flex-col">
            <p className="my-2 font-medium">Connected Address:</p>
            <Address address={connectedAddress} chain={targetNetwork} />
          </div>

          {/* Deposit Section (only on Sepolia) */}
          {connectedAddress && isOnSepolia && (
            <div className="mt-8 w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">Deposit ETH to Mint Rebase Tokens</h2>
              <div className="card bg-base-200 shadow-xl p-4">
                <p className="mb-2">
                  Your ETH Balance: {ethBalance ? formatEther(ethBalance.value) : "0"} ETH
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
                    {isPending ? "Confirming..." : isConfirming ? "Waiting..." : "Deposit"}
                  </button>
                </div>
                {isConfirmed && <p className="text-success mt-2">Deposit successful!</p>}
                {error && <p className="text-error mt-2">Error: {error.message}</p>}
              </div>
            </div>
          )}

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

const NetworkTokenInfo = ({ chainId, chainName, userAddress }: NetworkTokenInfoProps) => {
  const { data: balance, isLoading: balanceLoading } = useScaffoldReadContract({
    contractName: "RebaseToken",
    functionName: "balanceOf",
    args: [userAddress],
    chainId: chainId as typeof scaffoldConfig.targetNetworks[number]["id"],
  });

  const { data: interestRate, isLoading: rateLoading } = useScaffoldReadContract({
    contractName: "RebaseToken",
    functionName: "getUserInterestRate",
    args: [userAddress],
    chainId: chainId as typeof scaffoldConfig.targetNetworks[number]["id"],
  });

  return (
    <div className="card bg-base-200 shadow-xl p-4">
      <h3 className="text-lg font-bold">{chainName}</h3>
      <div className="mt-2">
        <p>
          <span className="font-medium">Balance:</span>{" "}
          {balanceLoading ? "Loading..." : balance ? formatEther(balance as bigint) : "0"}
        </p>
        <p>
          <span className="font-medium">Interest Rate:</span>{" "}
          {rateLoading ? "Loading..." : interestRate ? formatEther(interestRate as bigint) : "0"}
        </p>
      </div>
    </div>
  );
};

export default Home;
