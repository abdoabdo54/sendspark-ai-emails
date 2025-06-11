
import React, { useState } from "react";

export default function SmartConfig() {
  const [volume, setVolume] = useState(50000);
  const [accounts, setAccounts] = useState(10);
  const [functions, setFunctions] = useState(5);

  const recommend = () => {
    const recFunctions = Math.ceil(volume / 5000);
    const recAccounts = Math.ceil(volume / 5000);
    setFunctions(recFunctions);
    setAccounts(recAccounts);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Smart Config Recommendation</h2>
      <label>Email Volume: <input type="number" value={volume} onChange={e => setVolume(Number(e.target.value))} /></label><br/>
      <button onClick={recommend}>Get Recommendation</button>
      <p>Recommended Functions: {functions}</p>
      <p>Recommended Accounts: {accounts}</p>
    </div>
  );
}
