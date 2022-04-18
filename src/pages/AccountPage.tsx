import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from 'react';
import Modal from 'react-modal';
import { Card } from '../components/card/Card';
import { TiArrowSortedUp } from 'react-icons/ti';
import { TokenMetadata } from '../services/ft-contract';
import { GreenLButton } from '../components/button/Button';
import {
  useTokenBalances,
  useUserRegisteredTokensAllAndNearBalance,
} from '../state/token';
import Loading from '../components/layout/Loading';
import { wallet as webWallet } from '../services/near';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  NearIcon,
  RefIcon,
  WalletIcon,
  MappingAccountIcon,
} from '../components/icon/Common';
import {
  toReadableNumber,
  toInternationalCurrencySystemNature,
  toPrecision,
} from '../utils/numbers';
import BigNumber from 'bignumber.js';
import OldInputAmount from '../components/forms/OldInputAmount';
import { deposit, withdraw, batchWithdraw } from '../services/token';
import { nearMetadata, wrapNear } from '../services/wrap-near';
import { BeatLoading } from '../components/layout/Loading';
import { STORAGE_PER_TOKEN } from '../services/creators/storage';
import { IoCloseOutline } from 'react-icons/io5';
import ReactTooltip from 'react-tooltip';
import QuestionMark from '../components/farm/QuestionMark';
import { useHistory, useLocation, useParams } from 'react-router';
import {
  WalletContext,
  getCurrentWallet,
  getAccountName,
} from '../utils/sender-wallet';

import { getSenderLoginRes } from '../utils/sender-wallet';
import { Checkbox, CheckboxSelected, Near } from '../components/icon';
import { GradientButton, ButtonTextWrapper } from '../components/button/Button';
import { CloseIcon } from '../components/icon/Actions';
import { AccountTipMan } from '../components/icon/AccountTipMan';
import { defaultTokenList } from '../services/aurora/config';
import {
  batchWithdrawFromAurora,
  useAuroraBalancesNearMapping,
} from '../services/aurora/aurora';
import {
  SwapCross,
  AuroraIcon,
  ConnectDot,
} from '../components/icon/CrossSwap';
import {
  useAuroraBalances,
  auroraAddr,
  useAuroraTokens,
} from '../services/aurora/aurora';

const REF_MAN_ACCOUNT_TIP_KEY = 'REF_MAN_ACCOUNT_TIP_VALUE';
interface ParamTypes {
  tab: string;
}

function RefAccountTipMan({
  setShowTip,
}: {
  setShowTip: (show: boolean) => void;
}) {
  return (
    <div
      className="absolute RefAccountTipMan"
      style={{
        top: '-70px',
        right: '210px',
      }}
    >
      <span>
        <em></em>
      </span>
      <div
        className="relative border bg-cardBg rounded-lg border-gradientFrom pl-4 pr-8 py-2 text-sm text-white"
        style={{
          width: '430px',
        }}
      >
        <FormattedMessage
          id="ref_account_tip_3"
          defaultMessage="To withdraw token(s) from your REF Account to your NEAR Wallet, please select and withdraw"
        />
        .
        <div
          className="absolute pl-1 cursor-pointer"
          onClick={() => {
            setShowTip(false);
            localStorage.setItem(REF_MAN_ACCOUNT_TIP_KEY, '1');
          }}
          style={{
            right: '10px',
            top: '10px',
          }}
        >
          <CloseIcon />
        </div>
      </div>

      <AccountTipMan />
    </div>
  );
}

const withdraw_number_at_once = 5;
const accountSortFun = (
  by: string,
  currentSort: string,
  userTokens: TokenMetadata[],
  hasRefBalanceOver?: boolean
) => {
  const sortBy = by || 'near';

  const sortDirection =
    currentSort.split('-')[1] == 'down' && !hasRefBalanceOver ? 'up' : 'down';

  userTokens.sort((token1: TokenMetadata, token2: TokenMetadata) => {
    const { near: near1, ref: ref1, aurora: aurora1 } = token1;
    const { near: near2, ref: ref2, aurora: aurora2 } = token2;
    const near1Balance = new BigNumber(near1);
    const ref1Balance = new BigNumber(ref1);

    const aurora1Balance = new BigNumber(aurora1);
    const near2Balance = new BigNumber(near2);
    const ref2Balance = new BigNumber(ref2);
    const aurora2Balance = new BigNumber(aurora2);

    const a =
      sortBy == 'near'
        ? near1Balance
        : sortBy === 'ref'
        ? ref1Balance
        : aurora1Balance;
    const b =
      sortBy == 'near'
        ? near2Balance
        : sortBy === 'ref'
        ? ref2Balance
        : aurora2Balance;

    if (sortDirection == 'down') {
      if (a.isGreaterThan(b)) {
        return -1;
      } else if (a.isLessThan(b)) {
        return 1;
      } else {
        return 0;
      }
    } else {
      if (a.isLessThan(b)) {
        return -1;
      } else if (a.isGreaterThan(b)) {
        return 1;
      } else {
        return 0;
      }
    }
  });
  return {
    sortUserTokens: userTokens,
    curSort: sortBy + '-' + sortDirection,
  };
};
const getRefBalance = (item: TokenMetadata) => {
  const { ref } = item;
  const bigRef = new BigNumber(ref);
  if (bigRef.isEqualTo('0')) {
    return '-';
  } else if (bigRef.isLessThan(0.01)) {
    return '<0.01';
  } else {
    return toInternationalCurrencySystemNature(bigRef.toString());
  }
};
const getAuroraBalance = (item: TokenMetadata) => {
  const { aurora } = item;
  const bigAurora = new BigNumber(aurora);

  if (bigAurora.isEqualTo('0')) {
    return '-';
  } else if (bigAurora.isLessThan(0.01)) {
    return '<0.01';
  } else {
    return toInternationalCurrencySystemNature(bigAurora.toString());
  }
};

const getWalletBalance = (item: TokenMetadata) => {
  const { near } = item;
  const bigNear = new BigNumber(near);
  if (bigNear.isEqualTo('0')) {
    return '-';
  } else if (bigNear.isLessThan(0.01)) {
    return '<0.01';
  } else {
    return toInternationalCurrencySystemNature(near.toString());
  }
};
const NearTip = () => {
  const intl = useIntl();
  const tip = intl.formatMessage({ id: 'deposit_near_tip' });
  const result: string = `<div class="text-navHighLightText text-xs text-left font-normal">${tip}</div>`;
  return (
    <div
      className="ml-1.5"
      data-type="info"
      data-place="right"
      data-multiline={true}
      data-class="reactTip"
      data-html={true}
      data-tip={result}
      data-for="nearId"
    >
      <QuestionMark />
      <ReactTooltip
        className="w-20"
        id="nearId"
        backgroundColor="#1D2932"
        border
        borderColor="#7e8a93"
        effect="solid"
      />
    </div>
  );
};
const WithdrawTip = () => {
  const intl = useIntl();
  const tip = intl.formatMessage({ id: 'over_tip' });
  const result: string = `<div class="text-navHighLightText text-xs w-52 text-left font-normal">${tip}</div>`;
  return (
    <div
      className="ml-2"
      data-type="info"
      data-place="right"
      data-multiline={true}
      data-class="reactTip"
      data-html={true}
      data-tip={result}
      data-for="WithdrawTipId"
    >
      <QuestionMark />
      <ReactTooltip
        id="WithdrawTipId"
        backgroundColor="#1D2932"
        border
        borderColor="#7e8a93"
        effect="solid"
      />
    </div>
  );
};
function AccountTable(props: any) {
  const { userTokens, hasRefBalanceOver, showCrossBalance } = props;
  const [tokensSort, setTokensSort] = useState(userTokens);
  const [currentSort, setCurrentSort] = useState('');
  const [checkedMap, setCheckedMap] = useState({});
  const [checkAll, setCheckALl] = useState(false);
  const [refAccountHasToken, setRefAccountHasToken] = useState();
  const [auroraAccountHasToken, setAuroraAccountHasToken] = useState();

  const [withdrawLoading, setWithdrawLoading] = useState<boolean>(false);
  useEffect(() => {
    sort(null, hasRefBalanceOver);
    const refAccountHasToken = tokensSort.filter((token: TokenMetadata) => {
      const { ref } = token;
      if (Number(ref) > 0) return true;
    });

    const auroraAccountHasToken = tokensSort.filter((token: TokenMetadata) => {
      const { aurora } = token;
      return Number(aurora) > 0;
    });

    setRefAccountHasToken(refAccountHasToken.length);

    setAuroraAccountHasToken(auroraAccountHasToken.length);
  }, [hasRefBalanceOver]);

  const sort = (e?: any, hasRefBalanceOver?: boolean) => {
    const sortBy =
      e?.currentTarget.dataset.sort || (hasRefBalanceOver ? 'ref' : 'near');

    const { sortUserTokens, curSort } = accountSortFun(
      sortBy,
      currentSort,
      userTokens,
      hasRefBalanceOver
    );
    setTokensSort(Array.from(sortUserTokens));
    setCurrentSort(curSort);
  };
  function clickAllCheckbox() {
    const newStatus = !checkAll;
    let newCheckedMap = {};
    let count = 0;
    if (newStatus) {
      for (let i = 0; i < tokensSort.length; i++) {
        const { id, ref, aurora, decimals } = tokensSort[i];
        if (count >= withdraw_number_at_once) {
          break;
        } else if (!showCrossBalance && Number(ref) > 0) {
          ++count;
          newCheckedMap[id] = {
            id,
            decimals,
            amount: ref,
          };
        } else if (showCrossBalance && Number(aurora) > 0) {
          ++count;
          newCheckedMap[id] = {
            id,
            decimals,
            amount: aurora,
          };
        }
      }
    } else {
      newCheckedMap = {};
    }
    setCheckALl(newStatus);
    setCheckedMap(newCheckedMap);
  }
  function clickCheckbox(token: TokenMetadata) {
    if (!showCrossBalance) {
      const { id, ref, decimals } = token;
      if (checkedMap[id] || Number(ref) == 0) {
        delete checkedMap[id];
      } else if (Object.keys(checkedMap).length < withdraw_number_at_once) {
        checkedMap[id] = {
          id,
          decimals,
          amount: ref,
        };
      }
      if (
        Object.keys(checkedMap).length ==
        Math.min(withdraw_number_at_once, refAccountHasToken)
      ) {
        setCheckALl(true);
      } else {
        setCheckALl(false);
      }
      setCheckedMap(Object.assign({}, checkedMap));
    } else {
      const { id, aurora, decimals } = token;
      if (checkedMap[id] || Number(aurora) == 0) {
        delete checkedMap[id];
      } else if (Object.keys(checkedMap).length < withdraw_number_at_once) {
        checkedMap[id] = {
          id,
          decimals,
          amount: aurora,
        };
      }
      if (
        Object.keys(checkedMap).length ==
        Math.min(withdraw_number_at_once, auroraAccountHasToken)
      ) {
        setCheckALl(true);
      } else {
        setCheckALl(false);
      }
      setCheckedMap(Object.assign({}, checkedMap));
    }
  }
  function doWithDraw() {
    setWithdrawLoading(true);
    if (showCrossBalance) batchWithdrawFromAurora(checkedMap);
    else batchWithdraw(checkedMap);
  }
  return (
    <table className="w-full text-sm text-gray-400 mt-2 table-auto">
      <thead>
        <tr className="h-9">
          <th className="pl-6 text-left">
            <FormattedMessage id="tokens"></FormattedMessage>
          </th>
          <th className="text-right">
            <span
              onClick={(e) => sort(e, false)}
              data-sort="near"
              className={`flex items-center w-full justify-end ${
                currentSort.indexOf('near') > -1 ? 'text-greenColor' : ''
              }`}
            >
              <WalletIcon />
              <label className="mx-1 cursor-pointer">NEAR</label>
              <TiArrowSortedUp
                className={`cursor-pointer ${
                  currentSort == 'near-down' ? 'transform rotate-180' : ''
                }`}
              />
            </span>
          </th>
          <th className={`text-right ${!showCrossBalance ? 'hidden' : ''}`}>
            <span
              onClick={(e) => sort(e, false)}
              data-sort="ref"
              className={`flex items-center w-full justify-end ${
                currentSort.indexOf('ref') > -1 ? 'text-greenColor' : ''
              } ${refAccountHasToken ? '' : 'hidden'}`}
            >
              <RefIcon />
              <label className="mx-1 cursor-pointer">REF</label>
              <TiArrowSortedUp
                className={`cursor-pointer ${
                  currentSort == 'ref-down' ? 'transform rotate-180' : ''
                }`}
              />
            </span>
          </th>
          <th className={`text-right ${showCrossBalance ? '' : 'hidden'}`}>
            <span
              onClick={(e) => sort(e, false)}
              data-sort="aurora"
              className={`flex items-center w-full justify-end ${
                currentSort.indexOf('aurora') > -1 ? 'text-greenColor' : ''
              } ${auroraAccountHasToken ? '' : 'hidden'}`}
            >
              <MappingAccountIcon />
              <label className="mx-1 cursor-pointer">Mapping</label>
              <TiArrowSortedUp
                className={`cursor-pointer ${
                  currentSort == 'aurora-down' ? 'transform rotate-180' : ''
                }`}
              />
            </span>
          </th>
          <th
            className={`pl-8 ${
              (auroraAccountHasToken && showCrossBalance) ||
              (refAccountHasToken && !showCrossBalance)
                ? ''
                : 'hidden'
            }`}
          >
            <span className="flex items-center">
              <label className="cursor-pointer" onClick={clickAllCheckbox}>
                {checkAll ? (
                  <CheckboxSelected></CheckboxSelected>
                ) : (
                  <Checkbox></Checkbox>
                )}
              </label>
              <WithdrawTip />
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {tokensSort.map((item: TokenMetadata) => {
          return (
            <tr
              className={`h-16 border-t border-borderColor border-opacity-30 hover:bg-chartBg hover:bg-opacity-20 ${
                new BigNumber(item.near).isEqualTo('0') &&
                new BigNumber(item.ref).isEqualTo('0') &&
                new BigNumber(item.aurora)
                  ? 'hidden'
                  : ''
              }`}
              key={item.id}
            >
              <td className="pl-6">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full border border-gradientFromHover mr-2.5 overflow-hidden flex-shrink-0">
                    <img src={item.icon} className="w-full h-full"></img>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <label className="text-white text-lg font-semibold">
                        {item.symbol}
                      </label>
                      {item.symbol == 'NEAR' ? <NearTip /> : null}
                    </div>
                    <label className="text-xs text-primaryText break-all">
                      {item.id}
                    </label>
                  </div>
                </div>
              </td>
              <td
                width="15%"
                className="text-right text-white font-semibold text-base"
              >
                <span title={item.near.toString()}>
                  {getWalletBalance(item)}
                </span>
              </td>
              <td
                width={!showCrossBalance ? '15%' : '0'}
                className={`text-right text-white font-semibold text-base `}
              >
                <span
                  title={item.ref.toString()}
                  className={`${
                    refAccountHasToken && !showCrossBalance ? '' : 'hidden'
                  }`}
                >
                  {getRefBalance(item)}
                </span>
              </td>
              <td
                width={showCrossBalance ? '15%' : '0'}
                className={`text-right text-white font-semibold text-base`}
              >
                <span
                  title={item.aurora.toString()}
                  className={`${
                    auroraAccountHasToken && showCrossBalance ? '' : 'hidden'
                  }`}
                >
                  {getAuroraBalance(item)}
                </span>
              </td>

              <td
                width="15%"
                className={`pl-8 ${
                  (auroraAccountHasToken && showCrossBalance) ||
                  (refAccountHasToken && !showCrossBalance)
                    ? ''
                    : 'hidden'
                }`}
              >
                <label
                  className={`${
                    Number(item.ref) || Number(item.aurora) > 0
                      ? 'cursor-pointer'
                      : 'cursor-not-allowed'
                  } `}
                  onClick={() => {
                    clickCheckbox(item);
                  }}
                >
                  {checkedMap[item.id]?.amount ? (
                    <CheckboxSelected></CheckboxSelected>
                  ) : (
                    <Checkbox></Checkbox>
                  )}
                </label>
              </td>
            </tr>
          );
        })}
        <tr
          className={`h-16 border-t border-borderColor border-opacity-30 ${
            (refAccountHasToken && !showCrossBalance) ||
            (auroraAccountHasToken && showCrossBalance)
              ? ''
              : 'hidden'
          }`}
        >
          <td></td>
          <td></td>
          {showCrossBalance ? <td></td> : null}
          <td colSpan={2}>
            <div className="flex justify-center">
              <GradientButton
                color="#fff"
                className={`w-36 h-9 text-center text-base text-white mt-4 focus:outline-none font-semibold ${
                  Object.keys(checkedMap).length == 0 ? 'opacity-40' : ''
                }`}
                onClick={doWithDraw}
                disabled={Object.keys(checkedMap).length == 0}
                btnClassName={
                  Object.keys(checkedMap).length == 0
                    ? 'cursor-not-allowed'
                    : ''
                }
                loading={withdrawLoading}
              >
                <div>
                  <ButtonTextWrapper
                    loading={withdrawLoading}
                    Text={() => (
                      <FormattedMessage
                        id="withdraw"
                        defaultMessage="Withdraw"
                      />
                    )}
                  />
                </div>
              </GradientButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
function MobileAccountTable(props: any) {
  const { userTokens, type } = props;
  const [tokensSort, setTokensSort] = useState(userTokens);
  const [currentSort, setCurrentSort] = useState('');
  const [checkedMap, setCheckedMap] = useState({});
  const [checkAll, setCheckALl] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState<boolean>(false);
  const [refAccountHasToken, setRefAccountHasToken] = useState();
  useEffect(() => {
    sort(`${type} + '-up'`);
    if (type == 'ref') {
      const refAccountHasToken = tokensSort.filter((token: TokenMetadata) => {
        const { ref } = token;
        if (Number(ref) > 0) return true;
      });
      setRefAccountHasToken(refAccountHasToken.length);
    }
  }, [type]);
  const sort = (direction?: string) => {
    const { sortUserTokens, curSort } = accountSortFun(
      type,
      direction || currentSort,
      userTokens
    );
    setTokensSort(Array.from(sortUserTokens));
    setCurrentSort(curSort);
  };
  function clickAllCheckbox() {
    const newStatus = !checkAll;
    let newCheckedMap = {};
    let count = 0;
    if (newStatus) {
      for (let i = 0; i < tokensSort.length; i++) {
        const { id, ref, decimals } = tokensSort[i];
        if (count >= withdraw_number_at_once) {
          break;
        } else if (Number(ref) > 0) {
          ++count;
          newCheckedMap[id] = {
            id,
            decimals,
            amount: ref,
          };
        }
      }
    } else {
      newCheckedMap = {};
    }
    setCheckALl(newStatus);
    setCheckedMap(newCheckedMap);
  }
  function clickCheckbox(token: TokenMetadata) {
    const { id, ref, decimals } = token;
    if (checkedMap[id] || Number(ref) == 0) {
      delete checkedMap[id];
    } else if (Object.keys(checkedMap).length < withdraw_number_at_once) {
      checkedMap[id] = {
        id,
        decimals,
        amount: ref,
      };
    }
    if (
      Object.keys(checkedMap).length ==
      Math.min(withdraw_number_at_once, refAccountHasToken)
    ) {
      setCheckALl(true);
    } else {
      setCheckALl(false);
    }
    setCheckedMap(JSON.parse(JSON.stringify(checkedMap)));
  }
  function doWithDraw() {
    setWithdrawLoading(true);
    batchWithdraw(checkedMap);
  }
  return (
    <table className="text-left w-full text-sm text-gray-400 mt-8 table-auto">
      <thead>
        <tr className="h-9">
          <th className="pl-4">
            <FormattedMessage id="tokens"></FormattedMessage>
          </th>
          <th className={`pr-4 ${type == 'ref' ? 'hidden' : ''}`}>
            <span
              onClick={() => {
                sort();
              }}
              data-sort="near"
              className={`flex items-center w-full justify-end`}
            >
              <WalletIcon />
              <label className="mx-1 cursor-pointer">NEAR</label>
              <TiArrowSortedUp
                className={`cursor-pointer ${
                  currentSort == 'near-down' ? 'transform rotate-180' : ''
                }`}
              />
            </span>
          </th>
          <th className={`pr-4 ${type == 'near' ? 'hidden' : ''}`}>
            <span
              onClick={() => {
                sort();
              }}
              data-sort="ref"
              className={`flex items-center w-full justify-end`}
            >
              <RefIcon />
              <label className="mx-1 cursor-pointer">REF</label>
              <TiArrowSortedUp
                className={`cursor-pointer ${
                  currentSort == 'ref-down' ? 'transform rotate-180' : ''
                }`}
              />
            </span>
          </th>
          <th className={`pr-2 ${type == 'near' ? 'hidden' : ''}`}>
            <label className="cursor-pointer" onClick={clickAllCheckbox}>
              {checkAll ? (
                <CheckboxSelected></CheckboxSelected>
              ) : (
                <Checkbox></Checkbox>
              )}
            </label>
          </th>
        </tr>
      </thead>
      <tbody>
        {tokensSort.map((item: TokenMetadata) => {
          if (
            (type == 'ref' && new BigNumber(item.ref).isEqualTo(0)) ||
            (type == 'near' && new BigNumber(item.near).isEqualTo(0))
          ) {
            return null;
          } else
            return (
              <tr
                className={`h-16 border-t border-borderColor border-opacity-30 hover:bg-chartBg hover:bg-opacity-20 ${
                  (type == 'ref' && new BigNumber(item.ref).isEqualTo(0)) ||
                  (type == 'near' && new BigNumber(item.near).isEqualTo(0))
                    ? 'hidden'
                    : ''
                }`}
                key={item.id}
              >
                <td className="pl-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full border border-gradientFromHover mr-2.5 overflow-hidden flex-shrink-0">
                      <img src={item.icon} className="w-full h-full"></img>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <label className="text-white text-lg font-semibold">
                          {item.symbol}
                        </label>
                        {item.symbol == 'NEAR' ? <NearTip /> : null}
                      </div>
                      <label className="text-xs text-primaryText break-all">
                        {item.id}
                      </label>
                    </div>
                  </div>
                </td>
                <td className={`pr-4 ${type == 'ref' ? 'hidden' : ''}`}>
                  <div className="flex flex-col items-end py-4">
                    <label className="text-white font-semibold text-lg mb-1">
                      {getWalletBalance(item)}
                    </label>
                  </div>
                </td>
                <td className={`pr-4 ${type == 'near' ? 'hidden' : ''}`}>
                  <div className="flex flex-col items-end py-4">
                    <label className="text-white font-semibold text-lg mb-1">
                      {getRefBalance(item)}
                    </label>
                  </div>
                </td>
                <td className={`pr-2 ${type == 'near' ? 'hidden' : ''}`}>
                  <label
                    className="cursor-pointer"
                    onClick={() => {
                      clickCheckbox(item);
                    }}
                  >
                    {checkedMap[item.id]?.amount ? (
                      <CheckboxSelected></CheckboxSelected>
                    ) : (
                      <Checkbox></Checkbox>
                    )}
                  </label>
                </td>
              </tr>
            );
        })}
        <tr
          className={`h-16 border-t border-borderColor border-opacity-30  ${
            type == 'near' ? 'hidden' : ''
          }`}
        >
          <td colSpan={3}>
            <div className="flex flex-col justify-center items-center">
              <div
                className={`border border-primaryText p-2.5 text-xs text-navHighLightText text-left rounded-md m-3 mt-4 ${
                  Object.keys(checkedMap).length >= withdraw_number_at_once
                    ? ''
                    : 'hidden'
                }`}
              >
                <FormattedMessage id="over_tip"></FormattedMessage>
              </div>
              <GradientButton
                color="#fff"
                className={`w-36 h-9 text-center text-base text-white mt-2 focus:outline-none font-semibold ${
                  Object.keys(checkedMap).length == 0 ? 'opacity-40' : ''
                }`}
                onClick={doWithDraw}
                disabled={Object.keys(checkedMap).length == 0}
                btnClassName={
                  Object.keys(checkedMap).length == 0
                    ? 'cursor-not-allowed'
                    : ''
                }
                loading={withdrawLoading}
              >
                <div>
                  <ButtonTextWrapper
                    loading={withdrawLoading}
                    Text={() => (
                      <FormattedMessage
                        id="withdraw"
                        defaultMessage="Withdraw"
                      />
                    )}
                  />
                </div>
              </GradientButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
function Account(props: any) {
  const { userTokens } = props;
  const [visible, setVisible] = useState(false);

  const [hasRefBalanceOver, setHasRefBalanceOver] = useState<boolean>(false);

  useEffect(() => {
    const hasRefBalanceOver = userTokens.some((token: TokenMetadata) => {
      return Number(token.ref) > 0.001;
    });
    setHasRefBalanceOver(hasRefBalanceOver);
    setVisible(
      hasRefBalanceOver &&
        !localStorage.getItem(REF_MAN_ACCOUNT_TIP_KEY)?.toString()
    );
  }, []);

  const { globalState } = useContext(WalletContext);
  const isSignedIn = globalState.isSignedIn;
  const auroraAddress = auroraAddr(getCurrentWallet().wallet.getAccountId());

  const displayAddr = `${auroraAddress?.substring(
    0,
    6
  )}...${auroraAddress?.substring(
    auroraAddress.length - 6,
    auroraAddress.length
  )}`;
  const { wallet } = getCurrentWallet();
  const tab = new URLSearchParams(window.location.search).get('tab');

  console.log(tab);

  const [showCrossBalance, setShowCrossBalance] = useState(
    tab === 'aurora' || false
  );

  const accountTitle = !showCrossBalance ? (
    <>
      <NearIcon />
      <label className="ml-3 text-xl">
        {isSignedIn && getAccountName(wallet.getAccountId())}
      </label>
    </>
  ) : (
    <div className="flex items-center">
      <div
        className="rounded-2xl flex items-center text-sm text-white py-0.5 px-1.5 mr-px"
        style={{
          background: 'rgba(255, 255, 255, 0.15)',
        }}
      >
        <div className="mx-1">
          <Near color="white" />
        </div>

        <div className="mx-1">{getCurrentWallet().wallet.getAccountId()}</div>
      </div>

      <ConnectDot />
      <ConnectDot />

      <div
        className="rounded-2xl flex items-center text-sm text-white py-0.5 px-1.5 ml-px"
        style={{
          background: 'rgba(112, 212, 75, 0.15)',
        }}
      >
        <div className="mx-1">
          <AuroraIcon />
        </div>

        <div className="mx-1">{displayAddr}</div>
      </div>
    </div>
  );

  return (
    <div className="justify-center relative w-1/2 m-auto mt-16 xs:hidden md:hidden pb-5 flex flex-col">
      {visible ? <RefAccountTipMan setShowTip={setVisible} /> : null}

      <div className="flex items-center justify-between ">
        <div
          className="flex items-center font-semibold bg-cardBg rounded-t-lg text-white w-full"
          style={{
            height: '66px',
          }}
        >
          <div className="relative top-2 left-8 flex items-center">
            {accountTitle}
          </div>
        </div>

        <div
          className="pb-4 pl-5 accountPage-pc-top-right relative cursor-pointer"
          onClick={() => {
            setShowCrossBalance(!showCrossBalance);
          }}
        >
          <SwapCross ifCross={showCrossBalance} />
        </div>
      </div>

      <Card className=" w-full pt-2 pb-15 px-0 rounded-tl-none">
        <AccountTable
          userTokens={userTokens}
          hasRefBalanceOver={hasRefBalanceOver}
          showCrossBalance={showCrossBalance}
        />
      </Card>
    </div>
  );
}
function MobileAccount(props: any) {
  const { userTokens } = props;
  const [modal, setModal] = useState(null);
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('near');

  const { globalState } = useContext(WalletContext);
  const isSignedIn = globalState.isSignedIn;

  const { wallet } = getCurrentWallet();
  const [refAccountHasToken, setRefAccountHasToken] = useState(false);

  const switchTab = (type: string) => {
    setActiveTab(type);
  };
  useEffect(() => {
    const refAccountHasToken = userTokens.find((token: TokenMetadata) => {
      const { ref } = token;
      if (Number(ref) > 0) return true;
    });

    const hasRefBalanceOver = userTokens.some((token: TokenMetadata) => {
      return Number(token.ref) > 0.001;
    });

    if (hasRefBalanceOver) switchTab('ref');

    setRefAccountHasToken(!!refAccountHasToken);
  }, []);
  return (
    <div className="lg:hidden">
      <div
        className={`bg-cardBg rounded-lg mx-auto relative ${
          activeTab == 'ref' ? 'pb-10' : ''
        }`}
        style={{ width: '95vw' }}
      >
        <div className="flex text-white items-center justify-center py-6">
          <NearIcon />
          <label className="ml-3 text-xl">
            {isSignedIn && getAccountName(wallet.getAccountId())}
          </label>
        </div>
        <div className="px-3">
          <div className="flex items-center bg-acccountTab rounded-lg p-1">
            <label
              onClick={() => {
                switchTab('near');
              }}
              className={`flex items-center justify-center h-10 flex-grow text-base rounded-md  ${
                activeTab == 'near'
                  ? 'text-white bg-acccountBlock'
                  : 'text-primaryText'
              }`}
            >
              <FormattedMessage id="near_wallet"></FormattedMessage>
            </label>
            <label
              onClick={() => {
                switchTab('ref');
              }}
              className={`flex items-center justify-center h-10 flex-grow text-base rounded-md ${
                activeTab == 'ref'
                  ? 'text-white bg-acccountBlock'
                  : 'text-primaryText'
              } ${refAccountHasToken ? '' : 'hidden'}`}
            >
              <FormattedMessage id="ref_account"></FormattedMessage>
            </label>
          </div>
        </div>
        <MobileAccountTable
          type={activeTab}
          userTokens={userTokens}
        ></MobileAccountTable>
      </div>
    </div>
  );
}
export function ActionModel(props: any) {
  const { modal, visible, onRequestClose } = props;
  const [amount, setAmount] = useState('0');
  const [loading, setLoading] = useState<boolean>(false);
  const { token, action } = modal || {};
  useEffect(() => {
    if (!visible) {
      setAmount('0');
    }
  }, [visible]);
  const showBalance = () => {
    const big = new BigNumber(modal?.max || '0');
    if (big.isEqualTo('0')) {
      return '0';
    } else if (big.isLessThan('0.001')) {
      return '<0.001';
    } else {
      return toPrecision(max, 3, true);
    }
  };
  const onSubmit = () => {
    setLoading(true);
    if (action == 'deposit') {
      if (token.id === nearMetadata.id) {
        wrapNear(amount);
      } else {
        deposit({ token, amount });
      }
    } else if (action == 'withdraw') {
      withdraw({ token, amount });
    }
  };
  const getRealMax = () => {
    const bigMax = new BigNumber(modal?.max || 0);
    let result_max = modal?.max;

    if (action == 'deposit' && modal?.token?.symbol == 'NEAR') {
      if (bigMax.isGreaterThan('1')) {
        result_max = bigMax.minus(1).toString();
      } else {
        result_max = 0;
      }
    }
    return result_max;
  };
  const max = getRealMax();
  return (
    <Modal
      isOpen={visible}
      onRequestClose={() => {
        onRequestClose(false);
      }}
      style={{
        overlay: {
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
        },
        content: {
          outline: 'none',
        },
      }}
    >
      <Card
        className="px-4 py-6 lg:px-6 lg:py-6 xs:w-95vw md:w-95vw lg:w-40vw xl:w-35vw"
        style={{ border: '1px solid rgba(0, 198, 162, 0.5)' }}
      >
        <div className="flex items-center justify-between mb-12 lg:mb-16">
          <label className="text-white text-base lg:text-2xl ">
            <FormattedMessage id={action}></FormattedMessage>
          </label>
          <IoCloseOutline
            onClick={() => {
              onRequestClose(false);
            }}
            className="text-gray-400 text-2xl cursor-pointer"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="relative flex-grow xs:w-3/5 md:w-3/5">
            <div className="flex items-center text-primaryText text-xs absolute right-0 -top-6">
              <span className="mr-2 text-primaryText">
                {action == 'deposit' ? (
                  <WalletIcon></WalletIcon>
                ) : (
                  <RefIcon></RefIcon>
                )}
              </span>
              <FormattedMessage id="balance"></FormattedMessage>:{' '}
              <span title={max}>{showBalance()}</span>
            </div>
            <OldInputAmount max={max} onChangeAmount={setAmount} />
          </div>
          <div className="flex flex-shrink-0 rounded-full items-center ml-4 lg:ml-12">
            <label className="text-base lg:text-xl text-white font-semibold mr-2 lg:mr-5">
              {token?.symbol}
            </label>
            <img
              className="w-8 h-8 lg:w-10 lg:h-10 rounded-full border border-gradientFromHover flex-shrink-0"
              src={token?.icon}
            ></img>
          </div>
        </div>
        <GreenLButton
          color="#fff"
          className={`w-full text-center text-white my-6 mb-3 lg:my-8 lg:mb-6 focus:outline-none font-semibold `}
          onClick={onSubmit}
          disabled={
            !amount ||
            new BigNumber('0').isEqualTo(amount) ||
            new BigNumber(amount).isGreaterThan(max)
          }
          loading={loading}
        >
          {loading ? (
            <BeatLoading />
          ) : action == 'deposit' ? (
            <FormattedMessage id="deposit" />
          ) : (
            <FormattedMessage id="withdraw"></FormattedMessage>
          )}
        </GreenLButton>
        <p className="text-primaryText text-xs text-center">
          {action == 'deposit' ? (
            <>
              <FormattedMessage id="small_storage_fee_is_applied_of"></FormattedMessage>{' '}
              {STORAGE_PER_TOKEN} Ⓝ
            </>
          ) : null}
        </p>
      </Card>
    </Modal>
  );
}
export function AccountPage() {
  const { globalState } = useContext(WalletContext);
  const isSignedIn = globalState.isSignedIn;
  const history = useHistory();

  const senderLoginRes = getSenderLoginRes();

  if (!senderLoginRes && !webWallet.isSignedIn()) {
    history.push('/');
    return null;
  }

  const auroraAddress = auroraAddr(getCurrentWallet().wallet.getAccountId());

  const userTokens = useUserRegisteredTokensAllAndNearBalance(isSignedIn);
  const balances = useTokenBalances(); // inner account balance

  const auroaBalances = useAuroraBalancesNearMapping(auroraAddress);

  if (!userTokens || !balances || !auroaBalances) return <Loading />;

  userTokens.forEach((token: TokenMetadata) => {
    const { decimals, id, nearNonVisible, symbol } = token;
    token.ref = toReadableNumber(decimals, balances[id] || '0');
    token.near = toReadableNumber(decimals, (nearNonVisible || '0').toString());
    token.aurora = toReadableNumber(
      decimals,
      auroaBalances[id] || '0'
    ).toString();
  });
  return (
    <>
      <Account userTokens={userTokens} />
      <MobileAccount userTokens={userTokens} />
    </>
  );
}
