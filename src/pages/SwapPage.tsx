import React, { useEffect } from 'react';
import SwapCard from '~components/swap/SwapCard';
import Loading from '~components/layout/Loading';
import { useWhitelistTokens } from '../state/token';
import {
  isWNear,
  ftGetTokenMetadata,
  TokenMetadata,
} from '../services/ft-contract';
import { nearMetadata, WRAP_NEAR_CONTRACT_ID } from '../services/wrap-near';

export function excludeWNear(tokens: TokenMetadata[]) {
  let allTokens = tokens;
  allTokens.splice(
    allTokens.findIndex((token) => token.id === WRAP_NEAR_CONTRACT_ID),
    1
  );

  allTokens.push(nearMetadata);

  return allTokens;
}

function SwapPage() {
  const allTokens = useWhitelistTokens();
  if (!allTokens) return <Loading />;

  const newAllTokens = excludeWNear(allTokens);

  return (
    <div className="swap">
      <section className="lg:w-560px md:w-5/6 xs:w-full xs:p-2 m-auto relative">
        <SwapCard allTokens={newAllTokens} />
      </section>
    </div>
  );
}

export default SwapPage;
