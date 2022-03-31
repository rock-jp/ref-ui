import React, { useEffect, useState, useContext } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  GradientButton,
  ButtonTextWrapper,
  OprationButton,
  ConnectToNearBtn,
  OutlineButton,
  SolidButton,
  FarmButton,
} from '~components/button/Button';
import { ModalClose } from '~components/icon';
import QuestionMark from '~components/farm/QuestionMark';
import ReactTooltip from 'react-tooltip';
import Modal from 'react-modal';
import { mftGetBalance } from '~services/mft-contract';
import { unstake_v2_free, unstake_v2_cd } from '~services/m-token';
import { getMftTokenId, toRealSymbol } from '~utils/token';
import getConfig from '../../services/config';
import { BigNumber } from 'bignumber.js';
import moment from 'moment';
import { useHistory } from 'react-router';
import InputAmount, { NewFarmInputAmount } from '~components/forms/InputAmount';
import {
  toPrecision,
  toReadableNumber,
  toNonDivisibleNumber,
  toInternationalCurrencySystem,
  percent,
  formatWithCommas,
  percentLess,
  calculateFairShare,
} from '../../utils/numbers';
import {
  stake_v2,
  LP_TOKEN_DECIMALS,
  LP_STABLE_TOKEN_DECIMALS,
  withdrawAllReward,
} from '../../services/m-token';
import Alert from '~components/alert/Alert';
import {
  addLiquidityToPool,
  addPoolToWatchList,
  getWatchListFromDb,
  Pool,
  PoolDetails,
  removePoolFromWatchList,
} from '~services/pool';
import { Checkbox, CheckboxSelected } from '~components/icon';
import { ErrorTriangle } from '~components/icon/SwapRefresh';
import {
  ftGetTokenMetadata,
  TokenMetadata,
  unWrapToken,
} from '../../services/ft-contract';
import { useTokens, getDepositableBalance } from '~state/token';
import math, { e } from 'mathjs';
import { useWalletTokenBalances } from '../../state/token';
import { getCurrentWallet, WalletContext } from '../../utils/sender-wallet';
import { isMobile } from '~utils/device';
import { Card } from '~components/card/Card';
import { WarnTriangle } from '~components/icon/SwapRefresh';
import { ActionModel } from '~pages/AccountPage';
import { FaAngleUp, FaAngleDown, FaLeaf } from 'react-icons/fa';
import { PoolDetail } from './PoolDetail';
import {
  divide,
  scientificNotationToString,
  toRoundedReadableNumber,
} from '../../utils/numbers';
import { NewFarmPoolSlippageSelector } from '../forms/SlippageSelector';
import { Icon } from '../../pages/pools/DetailsPage';
import { StableSwapLogo } from '~components/icon/StableSwap';
import { CloseIcon } from '../icon/Actions';
import {
  useMonthTVL,
  useMonthVolume,
  usePool,
  useRemoveLiquidity,
  volumeDataType,
  volumeType,
  TVLDataType,
  TVLType,
  useDayVolume,
} from '~state/pool';
import { WRAP_NEAR_CONTRACT_ID } from '~services/wrap-near';
const STABLE_POOL_ID = getConfig().STABLE_POOL_ID;
const ONLY_ZEROS = /^0*\.?0*$/;

const REF_NEW_FARMING_POOL_TAB_KEY = 'REF_NEW_FARMING_POOL_TAB_VALUE';

function StakeTip({
  share,
  display,
  setDisplay,
  changeTab,
}: {
  share: string;
  display: boolean;
  setDisplay: (show: boolean) => void;
  changeTab: (e?: any) => void;
}) {
  console.log(display);
  return display ? (
    <div className="w-full py-6 bg-cardBg rounded-lg pl-8 mt-2 pr-6 xs:px-6 text-sm text-farmText flex items-center justify-between relative top-4 overflow-hidden">
      <div className="w-full bg-gradientFrom h-1.5 right-0 top-0 absolute"></div>
      <span>
        <FormattedMessage id="you_have " defaultMessage="You have" />
        <span className="text-white mx-1">
          {toRoundedReadableNumber({
            decimals: 24,
            number: share,
            precision: 2,
          })}
        </span>
        <FormattedMessage id="lp_tokens" defaultMessage={'LP tokens'} />
        {', '}
        <FormattedMessage id="go_to" defaultMessage="go to" />
        <span
          className="border-b border-gradientFrom border-opacity-60 text-gradientFrom cursor-pointer ml-1"
          onClick={() => {
            changeTab('stake');
          }}
        >
          <FormattedMessage id="STAKE" defaultMessage="STAKE" />
        </span>
      </span>

      <span
        className="pl-2 py-2 cursor-pointer"
        onClick={() => setDisplay(false)}
      >
        <CloseIcon />
      </span>
    </div>
  ) : null;
}

function PoolDetailMag({
  showReserves,
  setShowReserves,
  hidden,
}: {
  showReserves: boolean;
  setShowReserves: (e?: any) => void;
  hidden?: boolean;
}) {
  return (
    <span
      className={`px-5 rounded-t-xl text-sm text-farmText mx-auto flex items-center justify-center cursor-pointer bg-cardBg pt-3 relative bottom-10 ${
        showReserves ? 'pb-5' : 'pb-1.5'
      } ${hidden ? 'hidden' : ''}`}
      style={{
        borderTop: '1px solid #415462',
        width: '175px',
      }}
      onClick={() => {
        setShowReserves(!showReserves);
      }}
    >
      <span>
        <FormattedMessage id="pool_detail" defaultMessage="Pool Detail" />
      </span>
      <span className="ml-2">
        {showReserves ? <FaAngleUp /> : <FaAngleDown />}
      </span>
    </span>
  );
}

export default function PoolTab(props: any) {
  const history = useHistory();
  const { detailData, tokenPriceList, hidden, switchTopTab } = props;
  // const poolId = history.location.pathname.split('-')[0];
  const poolId = detailData[0]?.pool?.id;

  const { pool, shares, stakeList } = usePool(poolId); // todo

  const [activeTab, setActiveTab] = useState<string>('add');
  const tokens = useTokens(pool?.tokenIds);
  const switchTab = (tab: string) => {
    // localStorage.setItem(`${REF_NEW_FARMING_POOL_TAB_KEY}${pool.id}`, tab);
    setActiveTab(tab);
  };

  const [showStakeTip, setShowStakeTip] = useState<boolean>(Number(shares) > 0);

  useEffect(() => {
    setShowStakeTip(Number(shares) > 0);
  }, [shares]);

  const [showReserves, setShowReserves] = useState(false);

  if (!(tokens && tokens.length > 0 && pool)) return null;

  return (
    <>
      {!hidden ? (
        <StakeTip
          share={shares}
          changeTab={switchTopTab}
          display={showStakeTip}
          setDisplay={setShowStakeTip}
        />
      ) : null}

      <div className={hidden ? 'hidden' : ''}>
        <div
          className={` ${
            poolId !== STABLE_POOL_ID ? 'hidden' : 'block'
          } flex flex-col items-center justify-center mt-20 `}
        >
          <StableSwapLogo />
          <span className="text-sm text-farmText mt-4">
            <FormattedMessage id="go_to" defaultMessage="Go to" />{' '}
            <span
              className="text-gradientFrom border-b border-gradientFrom border-opacity-70 cursor-pointer"
              onClick={() => {
                history.push('/stableswap', { stableTab: 'add_liquidity' });
              }}
            >
              [
              <FormattedMessage id="sauce" defaultMessage="Sauce" />]
            </span>{' '}
            <FormattedMessage
              id="stable_pool_to_add_liquidity_now"
              defaultMessage="stable pool to add liquidity now"
            />
            .
          </span>
        </div>

        <div
          className={`poolBox relative mt-7 bg-cardBg rounded-2xl px-8 xs:px-6 pt-3 pb-16 ${
            hidden || poolId === STABLE_POOL_ID ? 'hidden' : ''
          }`}
        >
          <div className="tab relative flex mb-7">
            <div
              onClick={() => {
                switchTab('add');
              }}
              className={`flex relative items-center w-1/2 text-lg py-3.5 justify-center cursor-pointer ${
                activeTab == 'add' ? 'text-white' : 'text-primaryText'
              }`}
            >
              <span>
                <FormattedMessage id="add_liquidity" />
              </span>
              <div
                className={`absolute w-full -bottom-px left-0 h-1  rounded-full ${
                  activeTab == 'add' ? 'bg-greenColor' : ''
                }`}
              ></div>
            </div>
            <div
              onClick={() => {
                switchTab('remove');
              }}
              className={`flex relative items-center w-1/2  text-lg py-3.5 cursor-pointer justify-center ${
                activeTab == 'remove' ? 'text-white' : 'text-primaryText'
              }`}
            >
              <span>
                <FormattedMessage id="remove" />
              </span>
              <div
                className={`absolute w-full -bottom-px left-0 h-1  rounded-full ${
                  activeTab == 'remove' ? 'bg-greenColor' : ''
                }`}
              ></div>
            </div>
            <div
              className={`absolute w-full h-0.5 bottom-0 left-0 rounded-full bg-black bg-opacity-20`}
            ></div>
          </div>
          <div
            className={`operationArea ${
              activeTab === 'add' ? 'block' : 'hidden'
            }`}
          >
            <AddLiquidity pool={pool} tokens={tokens} />
          </div>
          <div
            className={`operationArea ${
              activeTab === 'remove' ? 'block' : 'hidden'
            }`}
          >
            <RemoveLiquidity pool={pool} tokens={tokens} shares={shares} />
          </div>
        </div>
        <PoolDetailMag
          showReserves={showReserves}
          setShowReserves={setShowReserves}
          hidden={poolId === STABLE_POOL_ID}
        />

        <PoolDetail pool={pool} showDetail={showReserves} />
      </div>
    </>
  );
}
export function AddLiquidity(props: { pool: Pool; tokens: TokenMetadata[] }) {
  // todo
  let { pool, tokens } = props;

  tokens = tokens.map((token) => unWrapToken(token, true));
  const [firstTokenAmount, setFirstTokenAmount] = useState<string>('');
  const [secondTokenAmount, setSecondTokenAmount] = useState<string>('');
  const [messageId, setMessageId] = useState<string>('add_liquidity');
  const [defaultMessage, setDefaultMessage] = useState<string>('Add Liquidity');
  const balances = useWalletTokenBalances(
    tokens.map((token) => unWrapToken(token).id)
  );
  const [error, setError] = useState<Error>();
  const intl = useIntl();
  const [canSubmit, setCanSubmit] = useState<boolean>(false);
  const [canDeposit, setCanDeposit] = useState<boolean>(false);
  const [buttonLoading, setButtonLoading] = useState<boolean>(false);
  const [preShare, setPreShare] = useState(null);
  const [modal, setModal] = useState(null);

  const { signedInState } = useContext(WalletContext);
  const isSignedIn = signedInState.isSignedIn;

  const { wallet } = getCurrentWallet();

  if (!balances) return null;

  balances[WRAP_NEAR_CONTRACT_ID] = balances['NEAR'];

  const changeFirstTokenAmount = (amount: string) => {
    setError(null);
    if (Object.values(pool.supplies).every((s) => s === '0')) {
      setFirstTokenAmount(amount);
      const zero = new BigNumber('0');
      if (
        zero.isLessThan(secondTokenAmount || '0') &&
        zero.isLessThan(amount || '0')
      ) {
        setPreShare(1);
      } else {
        setPreShare(null);
      }
      try {
        validate({
          firstAmount: amount,
          secondAmount: secondTokenAmount,
        });
      } catch (error) {
        setError(error);
      }
    } else {
      const fairShares = calculateFairShare({
        shareOf: pool.shareSupply,
        contribution: toNonDivisibleNumber(tokens[0].decimals, amount),
        totalContribution: pool.supplies[tokens[0].id],
      });
      let secondAmount = '';
      if (amount) {
        secondAmount = toReadableNumber(
          tokens[1].decimals,
          calculateFairShare({
            shareOf: pool.supplies[tokens[1].id],
            contribution: fairShares,
            totalContribution: pool.shareSupply,
          })
        );
      }
      setFirstTokenAmount(amount);
      setSecondTokenAmount(secondAmount);
      setPreShare(toReadableNumber(24, fairShares));
      try {
        validate({
          firstAmount: amount,
          secondAmount,
        });
      } catch (error) {
        setError(error);
      }
    }
  };

  const changeSecondTokenAmount = (amount: string) => {
    setError(null);
    if (Object.values(pool.supplies).every((s) => s === '0')) {
      setSecondTokenAmount(amount);
      const zero = new BigNumber('0');
      if (
        zero.isLessThan(firstTokenAmount || '0') &&
        zero.isLessThan(amount || '0')
      ) {
        setPreShare(1);
      } else {
        setPreShare(null);
      }
      try {
        validate({
          firstAmount: firstTokenAmount,
          secondAmount: amount,
        });
      } catch (error) {
        setError(error);
      }
    } else {
      const fairShares = calculateFairShare({
        shareOf: pool.shareSupply,
        contribution: toNonDivisibleNumber(tokens[1].decimals, amount),
        totalContribution: pool.supplies[tokens[1].id],
      });
      let firstAmount = '';
      if (amount) {
        firstAmount = toReadableNumber(
          tokens[0].decimals,
          calculateFairShare({
            shareOf: pool.supplies[tokens[0].id],
            contribution: fairShares,
            totalContribution: pool.shareSupply,
          })
        );
      }
      setSecondTokenAmount(amount);
      setFirstTokenAmount(firstAmount);
      setPreShare(toReadableNumber(24, fairShares));
      try {
        validate({
          firstAmount,
          secondAmount: amount,
        });
      } catch (error) {
        setError(error);
      }
    }
  };

  function validate({
    firstAmount,
    secondAmount,
  }: {
    firstAmount: string;
    secondAmount: string;
  }) {
    const firstTokenAmountBN = new BigNumber(firstAmount.toString());
    const firstTokenBalanceBN = new BigNumber(
      toReadableNumber(tokens[0].decimals, balances[tokens[0].id])
    );
    const secondTokenAmountBN = new BigNumber(secondAmount.toString());
    const secondTokenBalanceBN = new BigNumber(
      toReadableNumber(tokens[1].decimals, balances[tokens[1].id])
    );

    setCanSubmit(false);
    setCanDeposit(false);
    if (firstTokenAmountBN.isGreaterThan(firstTokenBalanceBN)) {
      setCanDeposit(true);
      const { id, decimals } = tokens[0];
      const modalData: any = {
        token: tokens[0],
        action: 'deposit',
      };
      getDepositableBalance(id, decimals).then((nearBalance) => {
        modalData.max = nearBalance;
        setModal(Object.assign({}, modalData));
      });
      setModal(modalData);

      return;
    }

    if (secondTokenAmountBN.isGreaterThan(secondTokenBalanceBN)) {
      setCanDeposit(true);
      // setMessageId('deposit_to_add_liquidity');
      // setDefaultMessage('Deposit to Add Liquidity');
      const { id, decimals } = tokens[1];
      const modalData: any = {
        token: tokens[1],
        action: 'deposit',
      };
      getDepositableBalance(id, decimals).then((nearBalance) => {
        modalData.max = nearBalance;
        setModal(Object.assign({}, modalData));
      });
      setModal(modalData);
      return;
    }

    if (ONLY_ZEROS.test(firstAmount)) {
      setCanSubmit(false);
      setMessageId('add_liquidity');
      setDefaultMessage('Add Liquidity');
      return;
    }

    if (ONLY_ZEROS.test(secondAmount)) {
      setCanSubmit(false);
      setMessageId('add_liquidity');
      setDefaultMessage('Add Liquidity');
      return;
    }

    if (!tokens[0]) {
      throw new Error(
        `${tokens[0].id} ${intl.formatMessage({
          id: 'is_not_exist',
        })}`
      );
    }

    if (!tokens[1]) {
      throw new Error(
        `${tokens[1].id} ${intl.formatMessage({
          id: 'is_not_exist',
        })}`
      );
    }

    setCanSubmit(true);
    setMessageId('add_liquidity');
    setDefaultMessage('Add Liquidity');
  }

  function submit() {
    return addLiquidityToPool({
      id: pool.id,
      tokenAmounts: [
        { token: tokens[0], amount: firstTokenAmount },
        { token: tokens[1], amount: secondTokenAmount },
      ],
    });
  }

  const ButtonRender = () => {
    if (!isSignedIn) {
      return <ConnectToNearBtn />;
    }

    const handleClick = async () => {
      if (canSubmit) {
        setButtonLoading(true);
        submit();
      }
    };
    return (
      <SolidButton
        disabled={!canSubmit || canDeposit}
        className="focus:outline-none  w-full text-lg"
        onClick={handleClick}
        loading={buttonLoading}
        padding={'p-4'}
        rounded={'rounded-lg'}
      >
        <div className="flex items-center justify-center w-full m-auto">
          <div>
            <ButtonTextWrapper
              loading={buttonLoading}
              Text={() => (
                <FormattedMessage
                  id={messageId}
                  defaultMessage={defaultMessage}
                />
              )}
            />
          </div>
        </div>
      </SolidButton>
    );
  };

  const shareDisplay = () => {
    let result = '';
    let percentShare = '';
    let displayPercentShare = '';
    if (preShare && new BigNumber('0').isLessThan(preShare)) {
      const myShareBig = new BigNumber(preShare);
      if (myShareBig.isLessThan('0.001')) {
        result = '<0.001';
      } else {
        result = `${myShareBig.toFixed(3)}`;
      }
    } else {
      result = '-';
    }

    if (result !== '-') {
      percentShare = `${percent(
        preShare,
        scientificNotationToString(
          new BigNumber(toReadableNumber(24, pool.shareSupply))
            .plus(new BigNumber(preShare))
            .toString()
        )
      )}`;

      if (Number(percentShare) > 0 && Number(percentShare) < 0.01) {
        displayPercentShare = '< 0.01%';
      } else {
        displayPercentShare = `${toPrecision(percentShare, 2)}%`;
      }
    }

    return (
      <span className="flex items-center">
        <span>{`${result}`}</span>
        <span className="text-xs ml-1 text-farmText">{`${displayPercentShare}`}</span>
      </span>
    );
  };
  return (
    <div className="text-white outline-none">
      <div className="mt-8">
        <div className="flex justify-end items-center text-sm text-right mb-1.5 text-farmText">
          <FormattedMessage id="balance" defaultMessage="Balance" />
          {':'}
          <span
            className="ml-1"
            title={toReadableNumber(tokens[0].decimals, balances[tokens[0].id])}
          >
            {toPrecision(
              toReadableNumber(tokens[0].decimals, balances[tokens[0].id]),
              2,
              true
            )}
          </span>
        </div>
        <div className="flex items-center ">
          <NewFarmInputAmount
            className="w-full border border-transparent rounded"
            max={toReadableNumber(tokens[0].decimals, balances[tokens[0].id])}
            onChangeAmount={changeFirstTokenAmount}
            value={firstTokenAmount}
            tokenSymbol={toRealSymbol(tokens[0].symbol)}
          />
        </div>
      </div>

      <span className="text-3xl text-primaryText mt-4 pl-6 font-thin block relative top-1">
        +
      </span>

      <div className="mb-8">
        <div className="flex justify-end items-center text-sm text-right mb-1.5 text-farmText">
          <FormattedMessage id="balance" defaultMessage="Balance" />
          {':'}
          <span
            className="ml-1"
            title={toReadableNumber(tokens[1].decimals, balances[tokens[1].id])}
          >
            {toPrecision(
              toReadableNumber(tokens[1].decimals, balances[tokens[1].id]),
              2,
              true
            )}
          </span>
        </div>
        <div className="flex items-center">
          <NewFarmInputAmount
            className="w-full border border-transparent rounded"
            max={toReadableNumber(tokens[1].decimals, balances[tokens[1].id])}
            onChangeAmount={changeSecondTokenAmount}
            value={secondTokenAmount}
            tokenSymbol={toRealSymbol(tokens[1].symbol)}
          />
        </div>
      </div>
      {error ? (
        <div className="flex justify-center mb-8 ">
          <Alert level="warn" message={error.message} />
        </div>
      ) : null}
      <div className="flex justify-between text-primaryText text-sm mt-6 mb-4">
        <label>
          <FormattedMessage id="lp_tokens" defaultMessage={'LP tokens'} />
        </label>
        <span className="text-white text-sm">
          {canDeposit ? '-' : shareDisplay()}
        </span>
      </div>
      {canDeposit ? (
        <div className="flex items-center rounded-md mb-6 py-3 px-4 xs:px-2 border border-warnColor">
          <label className="text-base text-warnColor xs:text-sm md:text-sm">
            <FormattedMessage id="oops" defaultMessage="Oops" />!
          </label>
          <label className="ml-2.5 text-base text-warnColor xs:text-sm md:text-sm">
            <FormattedMessage id="you_do_not_have_enough" />{' '}
            {modal?.token?.symbol}.
          </label>
        </div>
      ) : null}

      <ButtonRender />
    </div>
  );
}

export function RemoveLiquidity(props: {
  pool: Pool;
  shares: string;
  tokens: TokenMetadata[];
}) {
  const { pool, shares, tokens } = props;
  const [amount, setAmount] = useState<string>('');
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5);
  const { minimumAmounts, removeLiquidity } = useRemoveLiquidity({
    pool,
    slippageTolerance,
    shares: amount ? toNonDivisibleNumber(24, amount) : '0',
  });
  const [buttonLoading, setButtonLoading] = useState<boolean>(false);
  const [canSubmit, setCanSubmit] = useState<boolean>(false);
  const [error, setError] = useState<Error>();
  const intl = useIntl();

  const { signedInState } = useContext(WalletContext);
  const isSignedIn = signedInState.isSignedIn;

  function submit() {
    const amountBN = new BigNumber(amount?.toString());
    const shareBN = new BigNumber(toReadableNumber(24, shares));
    if (Number(amount) === 0) {
      throw new Error(
        intl.formatMessage({ id: 'must_input_a_value_greater_than_zero' })
      );
    }
    if (amountBN.isGreaterThan(shareBN)) {
      throw new Error(
        intl.formatMessage({
          id: 'input_greater_than_available_shares',
        })
      );
    }
    setButtonLoading(true);
    return removeLiquidity();
  }

  function handleChangeAmount(value: string) {
    setAmount(value);
    setError(null);

    const amountBN = new BigNumber(value.toString());
    const shareBN = new BigNumber(toReadableNumber(24, shares));
    if (amountBN.isGreaterThan(shareBN)) {
      setCanSubmit(false);
      throw new Error(
        intl.formatMessage({
          id: 'input_greater_than_available_tokens',
          defaultMessage: 'Input greater than available LP tokens',
        })
      );
    }
    if (ONLY_ZEROS.test(value)) {
      setCanSubmit(false);
      return;
    }
    setCanSubmit(true);
  }
  return (
    <div className="text-white outline-none mt-8">
      <div className=" overflow-hidden ">
        <NewFarmInputAmount
          maxBorder={false}
          value={amount}
          max={toReadableNumber(24, shares)}
          onChangeAmount={(value) => {
            try {
              handleChangeAmount(value);
            } catch (error) {
              setError(error);
            }
          }}
          tokenSymbol={
            <FormattedMessage id="lp_token" defaultMessage="LP Token" />
          }
          className="border border-transparent rounded"
          balance={toReadableNumber(24, shares)}
          title="Remove"
        />
      </div>
      <div className="pt-4 mb-8">
        <NewFarmPoolSlippageSelector
          slippageTolerance={slippageTolerance}
          onChange={setSlippageTolerance}
        />
      </div>

      {!ONLY_ZEROS.test(amount) && Number(pool.shareSupply) != 0 ? (
        <div className="flex items-center justify-between text-white text-sm mb-4">
          <p className="text-left  text-farmText">
            <FormattedMessage
              id="minimum_tokens_out"
              defaultMessage="Minimum shares"
            />
          </p>
          <div className="flex items-center">
            {Object.entries(minimumAmounts).map(
              ([tokenId, minimumAmount], i) => {
                const token = unWrapToken(
                  tokens.find((t) => t.id === tokenId),
                  true
                );

                const minAmountValue = toReadableNumber(
                  token.decimals,
                  minimumAmount
                );

                const minAmountValueTitle = toPrecision(minAmountValue, 0);

                const displayMinAmountValue =
                  Number(minAmountValue) < 0.0001
                    ? '< 0.0001'
                    : toInternationalCurrencySystem(
                        toPrecision(minAmountValue, 4),
                        4
                      );

                return (
                  <section key={i} className="flex items-center mx-1">
                    {i ? <span className="mr-2">+</span> : null}
                    <span
                      className="mr-2 text-base"
                      title={minAmountValueTitle}
                    >
                      {displayMinAmountValue}
                    </span>
                    <Icon icon={token?.icon} className="h-5 w-5" />
                  </section>
                );
              }
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex justify-center mb-5 mt-8 text-base">
          <Alert level="warn" message={error.message + '!'} />
        </div>
      ) : null}
      {isSignedIn ? (
        <SolidButton
          disabled={!canSubmit}
          className={`focus:outline-none w-full text-lg`}
          rounded={'rounded-lg'}
          padding={'p-4'}
          onClick={async () => {
            try {
              await submit();
            } catch (error) {
              setError(error);
            }
          }}
          loading={buttonLoading}
        >
          <ButtonTextWrapper
            loading={buttonLoading}
            Text={() => (
              <FormattedMessage
                id="remove_liquidity"
                defaultMessage="Remove Liquidity"
              />
            )}
          />
        </SolidButton>
      ) : (
        <ConnectToNearBtn />
      )}
    </div>
  );
}
