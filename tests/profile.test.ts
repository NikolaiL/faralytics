import assert from "node:assert/strict";
import { test } from "node:test";
import { withUsernameProofs } from "../packages/nextjs/lib/activity.ts";
test("missing profile username uses its unique registry proof while preserving display name and PFP", () => {
  const profile={fid:"1057806",username:null,display_name:"Hafiza Khaira",pfp_url:"https://example.com/pfp.png"};
  assert.deepEqual(withUsernameProofs([profile],[{fid:"1057806",username:"kasabiann"},{fid:"1057806",username:"kasabiann"}]),[{...profile,username:"kasabiann"}]);
});
test("registry fallback never guesses between aliases or replaces an existing primary username", () => {
  const profiles=[{fid:"1",username:"primary",display_name:null},{fid:"2",username:null,display_name:null},{fid:"3",username:null,display_name:null}];
  assert.deepEqual(withUsernameProofs(profiles,[{fid:"1",username:"other"},{fid:"2",username:"alias1"},{fid:"2",username:"alias2"},{fid:"3",username:""}]),profiles);
});
