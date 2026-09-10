"use client";

import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import externalContracts from "~~/contracts/externalContracts";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { getTargetNetworks } from "~~/utils/scaffold-eth/networks";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const targetNetworks = getTargetNetworks();

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

          {connectedAddress && (
            <div className="mt-8 w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">Your Token Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {targetNetworks.map(network => {
                  const contractConfig = externalContracts[network.id as keyof typeof externalContracts];
                  if (!contractConfig?.RebaseToken) return null;

                  return (
                    <NetworkTokenInfo
                      key={network.id}
                      chainId={network.id}
                      chainName={network.name}
                      userAddress={connectedAddress}
                      contractAddress={contractConfig.RebaseToken.address}
                      contractAbi={contractConfig.RebaseToken.abi}
                    />
                  );
                })}
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
  contractAddress: string;
  contractAbi: any;
};

const NetworkTokenInfo = ({ chainId, chainName, userAddress, contractAddress, contractAbi }: NetworkTokenInfoProps) => {
  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: "balanceOf",
    args: [userAddress],
    chainId,
  });

  const { data: interestRate, isLoading: rateLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: "getUserInterestRate",
    args: [userAddress],
    chainId,
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
