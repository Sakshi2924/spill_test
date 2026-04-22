#!/usr/bin/env node
'use strict';

require('dotenv').config();
const readline = require('readline');
const { createUser, readUsers } = require('../server/auth');

function prompt(q, { mask = false } = {}) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (mask) {
      process.stdout.write(q);
      let input = '';
      const stdin = process.stdin;
      const onData = ch => {
        ch = ch.toString('utf8');
        if (ch === '\r' || ch === '\n' || ch === '') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (ch === '') { process.exit(130); }
        else if (ch === '') { if (input.length) { input = input.slice(0, -1); process.stdout.write('\b \b'); } }
        else { input += ch; process.stdout.write('*'); }
      };
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on('data', onData);
    } else {
      rl.question(q, a => { rl.close(); resolve(a.trim()); });
    }
  });
}

(async () => {
  const existing = readUsers();
  if (existing.users.length > 0) {
    console.log('An admin already exists:', existing.users.map(u => u.username).join(', '));
    const ans = await prompt('Add another? (y/N) ');
    if (!/^y/i.test(ans)) process.exit(0);
  }
  const username = await prompt('Admin username: ');
  if (!username) { console.error('Username required.'); process.exit(1); }
  const p1 = await prompt('Password (12+ chars): ', { mask: true });
  const p2 = await prompt('Confirm password: ', { mask: true });
  if (p1 !== p2) { console.error('Passwords do not match.'); process.exit(1); }
  if (p1.length < 12) { console.error('Password must be 12+ characters.'); process.exit(1); }
  await createUser(username, p1);
  console.log(`\n✓ Admin "${username}" created.`);
})().catch(err => { console.error(err.message); process.exit(1); });
