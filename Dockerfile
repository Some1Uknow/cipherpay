FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive
ARG RUSTC_VERSION="v1.81.0"
ARG NODE_VERSION="v24.0.0"
ARG SOLANA_CLI="v2.2.14"
ARG ANCHOR_CLI="v0.31.1"

ENV HOME="/root"
ENV PATH="${HOME}/.cargo/bin:${PATH}"
ENV PATH="${HOME}/.local/share/solana/install/active_release/bin:${PATH}"
ENV PATH="${HOME}/.nvm/versions/node/${NODE_VERSION}/bin:${PATH}"

# Install base utilities.
RUN apt-get update -qq && apt-get upgrade -qq && apt-get install -qq \
    build-essential git curl wget jq pkg-config python3-pip \
    libssl-dev libudev-dev

# Install rust.
RUN curl "https://sh.rustup.rs" -sfo rustup.sh && \
    sh rustup.sh --default-toolchain ${RUSTC_VERSION#v} -y && \
    rustup component add rustfmt clippy

# Install Node.js and Corepack for Yarn 4
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    corepack enable && \
    corepack prepare yarn@4.6.0 --activate

# Install Solana tools.
RUN sh -c "$(curl -sSfL https://release.anza.xyz/${SOLANA_CLI}/install)"

# Install anchor.
RUN cargo install --git https://github.com/coral-xyz/anchor --tag ${ANCHOR_CLI} anchor-cli --locked

# Build a dummy program to bootstrap the BPF SDK (doing this speeds up builds).
RUN anchor init dummy && cd dummy && (anchor build || true)
RUN rm -r dummy

# Set up the working directory.
RUN mkdir /workdir
WORKDIR /workdir

# Copy the entrypoint script.
COPY . . 

RUN yarn install

RUN cargo tree

RUN anchor build

RUN anchor test