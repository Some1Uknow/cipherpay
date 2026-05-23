# Tests on ubuntu

Update rust
```
rustup update
```

*Be sure to look at the "members" path in your root `Cargo.toml`*
build:
```
anchor build
```

For some reason i can only run the test on WSL

running the local validotart myself in `C:\Windows\System32`:
```
solana-test-validator
```

deploy program:
```
anchor deploy
```

id: `C3qyHGtVXDTDqKR7ng1Q4ikYK2mKxyqtZLcWpgA1fKZV`

*After deploying for the first time, change the programId in `lib.rs` and root `Anchor.toml `*

and running the command myself
```
yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/*.ts 
```

test:
```
anchor tests
```