import React from 'react';
import CrossSwapCard from '~components/swap/CrossSwapCard';
import Loading from '~components/layout/Loading';
import { useWhitelistTokens } from '../state/token';

function CrossSwapPage() {
  const allTokens = useWhitelistTokens();
  if (!allTokens) return <Loading />;

  return (
    <div className="swap">
      <section className="lg:w-560px md:w-5/6 xs:w-full xs:p-2 m-auto relative">
        <CrossSwapCard allTokens={allTokens} />
      </section>
    </div>
  );
}

export default CrossSwapPage;
