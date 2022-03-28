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
import InputAmount from '~components/forms/InputAmount';
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
import { ftGetTokenMetadata, TokenMetadata } from '../../services/ft-contract';
import { useTokens, getDepositableBalance } from '~state/token';
import { e } from 'mathjs';
import { useWalletTokenBalances } from '../../state/token';
import { getCurrentWallet, WalletContext } from '../../utils/sender-wallet';
import { isMobile } from '~utils/device';
import { Card } from '~components/card/Card';
import { SmallWallet } from '../../components/icon/SmallWallet';
import { WarnTriangle } from '~components/icon/SwapRefresh';
import { ActionModel } from '~pages/AccountPage';
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
const STABLE_POOL_ID = getConfig().STABLE_POOL_ID;
const ONLY_ZEROS = /^0*\.?0*$/;
export default function PoolTab(props: any) {
  const { pool, shares, stakeList } = usePool('5'); // todo
  const { detailData, tokenPriceList, hidden } = props;
  const [activeTab, setActiveTab] = useState('add');
  const [addLiquidityModalVisible, setAddLiquidityModalVisible] =
    useState(false);
  const tokens = useTokens(pool?.tokenIds);
  const switchTab = (tab: string) => {
    setActiveTab(tab);
  };
  if (!(tokens && tokens.length > 0 && pool)) return null;
  return (
    <>
      <div
        className={`poolBox relative mt-7 bg-cardBg rounded-2xl px-7 py-3 ${
          hidden ? 'hidden' : ''
        }`}
      >
        <div className="tab relative flex mb-7">
          <div
            onClick={() => {
              switchTab('add');
            }}
            className={`flex relative items-center w-1/2 text-lg py-3.5  pl-20 cursor-pointer ${
              activeTab == 'add' ? 'text-white' : 'text-primaryText'
            }`}
          >
            <FormattedMessage id="add_liquidity"></FormattedMessage>
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
            className={`flex relative items-center w-1/2  text-lg py-3.5 pl-20 cursor-pointer ${
              activeTab == 'remove' ? 'text-white' : 'text-primaryText'
            }`}
          >
            <FormattedMessage id="remove"></FormattedMessage>
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
        <div className="operationArea">
          <AddLiquidity pool={pool} tokens={tokens}></AddLiquidity>
        </div>
      </div>
    </>
  );
}
export function AddLiquidity(props: { pool: Pool; tokens: TokenMetadata[] }) {
  // todo
  const { pool, tokens } = props;
  const [firstTokenAmount, setFirstTokenAmount] = useState<string>('');
  const [secondTokenAmount, setSecondTokenAmount] = useState<string>('');
  const [messageId, setMessageId] = useState<string>('add_liquidity');
  const [defaultMessage, setDefaultMessage] = useState<string>('Add Liquidity');
  const balances = useWalletTokenBalances(tokens.map((token) => token.id));
  const [error, setError] = useState<Error>();
  const intl = useIntl();
  const history = useHistory();
  const [canSubmit, setCanSubmit] = useState<boolean>(false);
  const [canDeposit, setCanDeposit] = useState<boolean>(false);
  const [buttonLoading, setButtonLoading] = useState<boolean>(false);
  const [preShare, setPreShare] = useState(null);
  const [modal, setModal] = useState(null);

  const { signedInState } = useContext(WalletContext);
  const isSignedIn = signedInState.isSignedIn;

  const { wallet } = getCurrentWallet();

  if (!balances) return null;

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
      // throw new Error(
      //   `${intl.formatMessage({ id: 'you_do_not_have_enough' })} ${toRealSymbol(
      //     tokens[1].symbol
      //   )}`
      // );
      return;
    }

    if (ONLY_ZEROS.test(firstAmount)) {
      setCanSubmit(false);
      setMessageId('add_liquidity');
      setDefaultMessage('Add Liquidity');
      return;
      // throw new Error(
      //   `${toRealSymbol(tokens[0].symbol)} ${intl.formatMessage({
      //     id: 'amount_must_be_greater_than_0',
      //   })} `
      // );
    }

    if (ONLY_ZEROS.test(secondAmount)) {
      setCanSubmit(false);
      setMessageId('add_liquidity');
      setDefaultMessage('Add Liquidity');
      return;
      // throw new Error(
      //   `${toRealSymbol(tokens[1].symbol)} ${intl.formatMessage({
      //     id: 'amount_must_be_greater_than_0',
      //   })} `
      // );
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

  const cardWidth = isMobile() ? '95vw' : '40vw';

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
        className="focus:outline-none px-4 w-full"
        onClick={handleClick}
        loading={buttonLoading}
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
    if (preShare && new BigNumber('0').isLessThan(preShare)) {
      const myShareBig = new BigNumber(preShare);
      if (myShareBig.isLessThan('0.001')) {
        result = '<0.001';
      } else {
        result = `≈ ${myShareBig.toFixed(3)}`;
      }
    } else {
      result = '-';
    }
    return result;
  };
  return (
    <div className="text-white outline-none">
      <div className="mt-8 md:hidden xs:hidden">
        <div className="flex justify-end items-center text-xs text-right mb-1 text-gray-400">
          <span className="mr-2 text-primaryText">
            <SmallWallet />
          </span>
          <FormattedMessage id="balance" defaultMessage="Balance" />
          :&nbsp;
          <span
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
          <div className="flex items-center mr-4 w-1/3">
            <Icon icon={tokens[0].icon} className="h-9 w-9 mr-2" />
            <div className="text-white text-base" title={tokens[0].id}>
              {toRealSymbol(tokens[0].symbol)}
            </div>
          </div>
          <InputAmount
            className="w-full border border-transparent rounded"
            max={toReadableNumber(tokens[0].decimals, balances[tokens[0].id])}
            onChangeAmount={changeFirstTokenAmount}
            value={firstTokenAmount}
          />
        </div>
      </div>
      <div className="my-8 md:hidden xs:hidden">
        <div className="flex justify-end items-center text-xs text-right mb-1 text-gray-400">
          <span className="mr-2 text-primaryText">
            <SmallWallet />
          </span>
          <FormattedMessage id="balance" defaultMessage="Balance" />
          :&nbsp;
          <span
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
          <div className="flex items-center mr-4 w-1/3">
            <Icon icon={tokens[1].icon} className="h-9 w-9 mr-2" />
            <div className="text-white text-base" title={tokens[1].id}>
              {toRealSymbol(tokens[1].symbol)}
            </div>
          </div>
          <InputAmount
            className="w-full border border-transparent rounded"
            max={toReadableNumber(tokens[1].decimals, balances[tokens[1].id])}
            onChangeAmount={changeSecondTokenAmount}
            value={secondTokenAmount}
          />
        </div>
      </div>
      {error ? (
        <div className="flex justify-center mb-8 ">
          <Alert level="warn" message={error.message} />
        </div>
      ) : null}

      {canDeposit ? (
        <div className="flex xs:flex-col md:flex-col justify-between items-center rounded-md p-4 xs:px-2 md:px-2 border border-warnColor">
          <div className="flex items-center xs:mb-3 md:mb-3">
            <label className="flex-shrink-0">
              <WarnTriangle />
            </label>
            <label className="ml-2.5 text-base text-warnColor xs:text-sm md:text-sm">
              <FormattedMessage id="you_do_not_have_enough" />{' '}
              {modal?.token?.symbol}！
            </label>
          </div>
        </div>
      ) : null}
      <div className="flex justify-between text-primaryText text-sm my-6">
        <label>
          <FormattedMessage id="my_shares"></FormattedMessage>
        </label>
        <span className="text-white text-sm">{shareDisplay()}</span>
      </div>
      <div className="">
        <ButtonRender />
      </div>
    </div>
  );
}
function Icon(props: { icon?: string; className?: string; style?: any }) {
  const { icon, className, style } = props;
  return icon ? (
    <img
      className={`block ${className} rounded-full border border-gradientFromHover border-solid`}
      src={icon}
      style={style}
    />
  ) : (
    <div
      className={`rounded-full ${className} border border-gradientFromHover  border-solid`}
      style={style}
    />
  );
}
