const fs = require("node:fs");
const assert = require("node:assert/strict");

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require("@firebase/rules-unit-testing");

async function main() {
  const projectId = "potsplit-security-tests";
  const bankId = "test-bank";
  const memberId = "test-member";
  const groupId = "test-group";
  const groupCode = "ABC234";

  const env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync("firestore.rules", "utf8")
    }
  });

  try {
    const bank = env.authenticatedContext(bankId).firestore();
    const member = env.authenticatedContext(memberId).firestore();

    const groupRef = bank.collection("groups").doc(groupId);
    const memberRef = groupRef.collection("members").doc(memberId);
    const sessionRef = groupRef.collection("session").doc("main");

    const groupData = {
      name: "Security Test Group",
      bankId,
      bankName: "Test Bank",
      groupCode,
      status: "active",
      createdAt: new Date()
    };

    await assertSucceeds(groupRef.set(groupData));
    console.log("PASS: Bank can create group");

    const membership = {
      userId: memberId,
      name: "Test Member",
      role: "member",
      groupCode,
      membershipId: "test-membership-1",
      joinedAt: new Date()
    };

    const invalidCodeRef = member
      .collection("groups").doc(groupId)
      .collection("members").doc("invalid-code-user");

    // Use a separate authenticated user for each attempted membership.
    const invalidCodeUser = env.authenticatedContext("invalid-code-user").firestore();

    await assertFails(
      invalidCodeUser.collection("groups").doc(groupId)
        .collection("members").doc("invalid-code-user")
        .set({
          ...membership,
          userId: "invalid-code-user",
          groupCode: "WRONG1"
        })
    );
    console.log("PASS: Invalid group code rejected");

    const extraFieldUser = env.authenticatedContext("extra-field-user").firestore();

    await assertFails(
      extraFieldUser.collection("groups").doc(groupId)
        .collection("members").doc("extra-field-user")
        .set({
          ...membership,
          userId: "extra-field-user",
          isAdmin: true
        })
    );
    console.log("PASS: Unauthorized membership field rejected");

    const missingIdUser = env.authenticatedContext("missing-id-user").firestore();

    const { membershipId, ...membershipWithoutId } = membership;

    await assertFails(
      missingIdUser.collection("groups").doc(groupId)
        .collection("members").doc("missing-id-user")
        .set({
          ...membershipWithoutId,
          userId: "missing-id-user"
        })
    );
    console.log("PASS: Missing membership ID rejected");
    await assertSucceeds(memberRef.set(membership));
    console.log("PASS: Member can join with valid code");

    await assertFails(member.collection("groups").doc(groupId).collection("session").doc("main").set({ amount: 9999 }));
    console.log("PASS: Member cannot modify group session");

    await assertSucceeds(memberRef.delete());
    console.log("PASS: Bank can remove member");

    await assertFails(member.collection("groups").doc(groupId).get());
    console.log("PASS: Removed member cannot read group");
  } finally {
    await env.cleanup();
  }
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
