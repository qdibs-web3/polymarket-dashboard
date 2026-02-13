import hre from "hardhat";

async function main() {
  console.log("Sending transaction using the OP chain type");

  const [sender] = await hre.ethers.getSigners();

  console.log("Sending 1 wei from", sender.address, "to itself");

  console.log("Sending L2 transaction");
  const tx = await sender.sendTransaction({
    to: sender.address,
    value: 1n,
  });

  await tx.wait();

  console.log("Transaction sent successfully");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });