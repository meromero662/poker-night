const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  initializeTestEnvironment
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "demo-potsplit-security";

async function main() {
  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync("firestore.rules", "utf8")
    }
  });

  try {
    await env.clearFirestore();

    // Simulate two devices editing the same session.
    const db1 = env.authenticatedContext("bank-user").firestore();
    const db2 = env.authenticatedContext("bank-user").firestore();

    const groupRef = db1.collection("groups").doc("concurrency-test");
    const sessionRef1 = groupRef.collection("session").doc("main");
    const sessionRef2 = db2.collection("groups")
      .doc("concurrency-test")
      .collection("session")
      .doc("main");

    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("groups")
        .doc("concurrency-test")
        .set({ bankId: "bank-user", groupCode: "ABC234" });
    });

    await sessionRef1.set({ players: {} });

    async function addBuyIn(ref, name, amount) {
      await ref.firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const latest = snapshot.exists
          ? snapshot.data()
          : { players: {} };

        if (!latest.players) latest.players = {};

        if (!latest.players[name]) {
          latest.players[name] = { buyIns: [], cashout: null };
        }

        latest.players[name].buyIns.push({
          amount,
          time: "20:00"
        });

        transaction.set(ref, latest);
      });
    }

    await Promise.all([
      addBuyIn(sessionRef1, "Alice", 100),
      addBuyIn(sessionRef2, "Bob", 200)
    ]);

    const result = (await sessionRef1.get()).data();

    assert.equal(result.players.Alice.buyIns[0].amount, 100);
    assert.equal(result.players.Bob.buyIns[0].amount, 200);

    console.log("PASS: Two simultaneous buy-ins preserved");
    console.log("PASS: Concurrency test environment ready");
    console.log("Project:", PROJECT_ID);
    console.log("Firestore Emulator: 127.0.0.1:8080");
  } finally {
    await env.cleanup();
  }
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
