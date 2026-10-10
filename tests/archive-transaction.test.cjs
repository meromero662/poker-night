
const assert = require("node:assert/strict");
const fs = require("node:fs");

const {
  initializeTestEnvironment
} = require("@firebase/rules-unit-testing");

async function main() {
  const env = await initializeTestEnvironment({
    projectId: "demo-potsplit-security",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync("firestore.rules", "utf8")
    }
  });

  try {
    const bank = env.authenticatedContext("test-bank").firestore();

    const groupRef = bank.collection("groups").doc("archive-test");
    const sessionRef = groupRef.collection("session").doc("main");
    const archiveRef = groupRef.collection("archive").doc();

    const players = {
      Mero: {
        buyIns: [{ amount: 200, time: "20:00" }],
        cashout: 350
      }
    };

    await groupRef.set({
      bankId: "test-bank",
      name: "Archive Test",
      groupCode: "ABC234"
    });

    await sessionRef.set({ players });

    await bank.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(sessionRef);

      assert.deepEqual(snapshot.data().players, players);

      transaction.set(archiveRef, {
        players: snapshot.data().players,
        archivedAt: new Date()
      });

      transaction.set(sessionRef, { players: {} });
    });

    const archived = await archiveRef.get();
    const session = await sessionRef.get();

    assert.equal(archived.exists, true);
    assert.deepEqual(archived.data().players, players);
    assert.deepEqual(session.data().players, {});

    console.log("PASS: Archive and reset transaction");
    // A failed transaction must preserve the active session.
    const rollbackPlayers = {
      Sherrie: {
        buyIns: [{ amount: 300, time: "21:00" }],
        cashout: 450
      }
    };

    await sessionRef.set({ players: rollbackPlayers });

    const failedArchiveRef = groupRef.collection("archive").doc();

    await assert.rejects(
      bank.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(sessionRef);

        transaction.set(failedArchiveRef, {
          players: snapshot.data().players,
          archivedAt: new Date()
        });

        transaction.set(sessionRef, { players: {} });

        // Simulate a failure before Firestore commits.
        throw new Error("SIMULATED_ARCHIVE_FAILURE");
      }),
      /SIMULATED_ARCHIVE_FAILURE/
    );

    const failedArchive = await failedArchiveRef.get();
    const sessionAfterFailure = await sessionRef.get();

    assert.equal(failedArchive.exists, false);
    assert.deepEqual(
      sessionAfterFailure.data().players,
      rollbackPlayers
    );

    console.log("PASS: Failed transaction preserves session");
    // Reject archiving when the saved session differs from the expected state.
    const expectedPlayers = rollbackPlayers;
    const updatedPlayers = {
      Sherrie: {
        buyIns: [{ amount: 500, time: "21:30" }],
        cashout: 450
      }
    };

    await sessionRef.set({ players: updatedPlayers });

    const staleArchiveRef = groupRef.collection("archive").doc();

    await assert.rejects(
      bank.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(sessionRef);
        const savedPlayers = snapshot.exists
          ? (snapshot.data().players || {})
          : {};

        if (JSON.stringify(savedPlayers) !== JSON.stringify(expectedPlayers)) {
          throw new Error("SESSION_CHANGED");
        }

        transaction.set(staleArchiveRef, {
          players: savedPlayers,
          archivedAt: new Date()
        });

        transaction.set(sessionRef, { players: {} });
      }),
      /SESSION_CHANGED/
    );

    const staleArchive = await staleArchiveRef.get();
    const sessionAfterStaleAttempt = await sessionRef.get();

    assert.equal(staleArchive.exists, false);
    assert.deepEqual(
      sessionAfterStaleAttempt.data().players,
      updatedPlayers
    );

    console.log("PASS: Stale session cannot be archived");
  } finally {
    await env.cleanup();
  }
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
