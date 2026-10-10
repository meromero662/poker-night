const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
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
    // Start every test run with an empty emulator database.
    await env.clearFirestore();

    const bank = env.authenticatedContext("bank-user").firestore();
    const member = env.authenticatedContext("member-user").firestore();

    const groupId = "membership-test-group";
    const groupCode = "ABC234";

    const groupRef = bank.collection("groups").doc(groupId);
    const codeRef = bank.collection("groupCodes").doc(groupCode);

    // Test 1: Bank creates a group and invitation code atomically.
    await assertSucceeds(bank.runTransaction(async (tx) => {
      const existingCode = await tx.get(codeRef);
      assert.equal(existingCode.exists, false);

      tx.set(groupRef, {
        name: "Security Test Group",
        bankId: "bank-user",
        bankName: "Bank",
        groupCode,
        status: "active",
        createdAt: new Date()
      });

      tx.set(codeRef, {
        groupId,
        bankId: "bank-user",
        createdAt: new Date()
      });
    }));

    console.log("PASS: Bank can create a group");

    // Test 2: Member joins using a valid invitation code.
    const memberRef = member.collection("groups")
      .doc(groupId).collection("members").doc("member-user");

    await assertSucceeds(memberRef.set({
      userId: "member-user",
      name: "Member",
      role: "member",
      groupCode,
      membershipId: "membership-001",
      joinedAt: new Date()
    }));

    console.log("PASS: Valid membership accepted");

    // Test 3: Another user attempts an invalid invitation code.
    const attackerRef = member.collection("groups")
      .doc(groupId).collection("members").doc("attacker-user");

    await assertFails(attackerRef.set({
      userId: "attacker-user",
      name: "Attacker",
      role: "member",
      groupCode: "WRONG1",
      membershipId: "membership-002",
      joinedAt: new Date()
    }));

    console.log("PASS: Invalid membership rejected");

    // Test 4: Correct user identity, but incorrect invitation code.
    const invalidCodeUser = env.authenticatedContext("invalid-code-user").firestore();

    const invalidCodeRef = invalidCodeUser.collection("groups")
      .doc(groupId).collection("members").doc("invalid-code-user");

    await assertFails(invalidCodeRef.set({
      userId: "invalid-code-user",
      name: "Invalid Code User",
      role: "member",
      groupCode: "WRONG1",
      membershipId: "membership-003",
      joinedAt: new Date()
    }));

    console.log("PASS: Invalid invitation code rejected");

    // Test 5: Member cannot change group ownership.
    const memberGroupRef = member.collection("groups").doc(groupId);

    await assertFails(memberGroupRef.update({
      bankId: "member-user"
    }));

    console.log("PASS: Member cannot change group ownership");

    // Test 6: Member cannot modify another member.
    const otherMemberRef = member.collection("groups")
      .doc(groupId).collection("members").doc("bank-user");

    await assertFails(otherMemberRef.set({
      userId: "bank-user",
      name: "Modified Bank",
      role: "member",
      groupCode,
      membershipId: "fake-membership",
      joinedAt: new Date()
    }));

    console.log("PASS: Member cannot modify another member");

    // Test 7: Member cannot edit the active session.
    const sessionRef = member.collection("groups")
      .doc(groupId).collection("session").doc("main");

    await assertFails(sessionRef.set({
      players: {
        Attacker: {
          buyIns: [{ amount: 9999, time: "20:00" }],
          cashout: null
        }
      }
    }));

    console.log("PASS: Member cannot edit session");

  } finally {
    await env.cleanup();
  }
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
