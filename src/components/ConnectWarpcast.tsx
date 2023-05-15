import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { randomBytes } from "tweetnacl";
import { bytesToHexString, getHubRpcClient, Message } from "@farcaster/hub-web";
import tweetnacl from "tweetnacl";

const ConnectWarpcast = () => {
  const [signerRequestToken, setSignerRequestToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [isSignerApproved, setIsSignerApproved] = useState(false);
  const [base64SignedMessage, setBase64SignedMessage] = useState("");

  const generateKeyPair = () => {
    const privateKey = randomBytes(32);
    const publicKey = tweetnacl.sign.keyPair.fromSeed(privateKey).publicKey;
    return { publicKey, privateKey };
  };

  const handleConnectClick = async () => {
    try {
      const keyPair = generateKeyPair();
      const publicKeyString = bytesToHexString(
        keyPair.publicKey
      )._unsafeUnwrap();
      setPublicKey(publicKeyString);

      // Call the signer request API to initiate the flow
      const response = await fetch("/api/signer-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publicKey: publicKeyString,
          name: "Farbook",
        }),
      });
      const data = await response.json();
      console.log("Response Data:", data);
      setSignerRequestToken(data.result.token);
    } catch (error) {
      console.error("Error connecting with Warpcast:", error);
    }
  };

  useEffect(() => {
    const pollForSigner = async (token) => {
      while (true) {
        // Poll at a reasonable rate to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const response = await fetch(
          `https://api.warpcast.com/v2/signer-request?token=${token}`
        );
        const data = await response.json();
        console.log("Polling response:", data);

        if (data.result && data.result.signerRequest.base64SignedMessage) {
          console.log(
            "Signer is approved with fid:",
            data.result.signerRequest.fid
          );
          setIsSignerApproved(true);
          setBase64SignedMessage(data.result.signerRequest.base64SignedMessage);
          break;
        }
      }
    };

    if (signerRequestToken) {
      pollForSigner(signerRequestToken);
    }
  }, [signerRequestToken]);

  const handleSubmitMessage = async () => {
    try {
      const client = await getHubRpcClient("https://galaxy.ditti.xyz:2285");
      const message = Message.decode(
        Buffer.from(base64SignedMessage, "base64")
      );
      await client.submitMessage(message);
      console.log("Message submitted to Hub:", message);
    } catch (error) {
      console.error("Error submitting message to Hub:", error);
    }
  };

  return (
    <div>
      <button onClick={handleConnectClick}>Connect with Warpcast</button>
      {publicKey && <p>Public Key: {publicKey}</p>}
      {signerRequestToken && (
        <>
          <p>Scan the QR code below to authorize the signer request:</p>
          <QRCode
            value={`farcaster://signer-add?token=${signerRequestToken}`}
          />
        </>
      )}
      {isSignerApproved && base64SignedMessage && (
        <div>
          <p>Signer is approved!</p>
          <button onClick={handleSubmitMessage}>Submit Message to Hub</button>
        </div>
      )}
    </div>
  );
};

export default ConnectWarpcast;
