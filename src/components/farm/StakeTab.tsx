import React, { useEffect, useRef, useState, useContext } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  ArrowLeftIcon,
  GoldLevel1,
  GoldLevel2,
  GoldLevel3,
  GoldLevel4,
  LockedIcon,
  UnLockedIcon,
} from '~components/icon/FarmV2';
import {
  GradientButton,
  ButtonTextWrapper,
  OprationButton,
  ConnectToNearButton,
} from '~components/button/Button';
import { ModalClose } from '~components/icon';
import { getUnclaimedReward, list_user_seed_info } from '~services/farm';
import QuestionMark from '~components/farm/QuestionMark';
import ReactTooltip from 'react-tooltip';
import Modal from 'react-modal';
import { mftGetBalance } from '~services/mft-contract';
import { unstake_v2_free, unstake_v2_cd } from '~services/m-token';
import { getMftTokenId } from '~utils/token';
import getConfig from '../../services/config';
import { BigNumber } from 'bignumber.js';
import moment from 'moment';
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
  cdStrategy,
  list_seeds_v2,
  get_cd_strategy,
  get_user_seed_info_by_seedId,
  get_seed_info_by_seedId,
  list_farms_by_seed,
  list_user_cd_account,
  getServerTime,
  get_seed_info,
} from '~services/farm';
import { Checkbox, CheckboxSelected } from '~components/icon';
import { ErrorTriangle } from '~components/icon/SwapRefresh';
import { ftGetTokenMetadata, unWrapToken } from '../../services/ft-contract';
import { useTokens } from '~state/token';
import { useHistory } from 'react-router-dom';
import { getCurrentWallet, WalletContext } from '../../utils/sender-wallet';
const STABLE_POOL_ID = getConfig().STABLE_POOL_ID;
export default function StakeTab(props: any) {
  const { signedInState } = useContext(WalletContext);
  const isSignedIn = signedInState.isSignedIn;
  const [activeTab, setActiveTab] = useState(
    !isSignedIn || getFarmsStatus() == 'r' ? 'stake' : 'unstake'
  );
  const [cd_strategy, set_cd_strategy] = useState<any[]>();
  const [serverTime, setServerTime] = useState<string | number>();
  const history = useHistory();
  const { detailData, tokenPriceList, hidden } = props;
  const seedId = detailData[0]['seed_id'];
  const pool = detailData[0]['pool'];
  const switchTab = function (tab: string) {
    setActiveTab(tab);
  };
  useEffect(() => {
    get_cd_strategy_list();
    get_server_time();
  }, []);
  const get_server_time = async () => {
    const timestamp = await getServerTime();
    const serverTime = new BigNumber(timestamp)
      .dividedBy(1000000)
      .toFixed(0, 1);
    setServerTime(serverTime);
  };
  const get_cd_strategy_list = async () => {
    const { seed_slash_rate, stake_strategy = [] } = await get_cd_strategy();
    const goldList = [
      <GoldLevel1></GoldLevel1>,
      <GoldLevel2></GoldLevel2>,
      <GoldLevel3></GoldLevel3>,
      <GoldLevel4></GoldLevel4>,
    ];
    const list = stake_strategy.filter((item: cdStrategy, index: number) => {
      if (item.enable) {
        item['index'] = index;
        item['month'] = item.lock_sec / (30 * 24 * 60 * 60);
        item['realRate'] = item.power_reward_rate / 10000 + 1;
        item['icon'] = goldList[index];
        return true;
      }
    });
    set_cd_strategy(list);
  };
  function getUrlParams() {
    const pathArr = location.pathname.split('/');
    const id = pathArr[2] || '';
    return id;
  }
  function getFarmsStatus() {
    const urlParamId = getUrlParams();
    const status = urlParamId.split('-')[2];
    return status;
  }
  const farmsStatus = getFarmsStatus();
  return (
    <div className={`${hidden ? 'hidden' : ''}`}>
      <div className={`takeBox relative mt-7 bg-cardBg rounded-2xl px-7 py-3`}>
        <div className="tab relative flex mb-7">
          <div
            onClick={() => {
              switchTab('stake');
            }}
            className={`relative items-center w-1/2 text-lg py-3.5  pl-20 cursor-pointer ${
              farmsStatus == 'e' ? 'hidden' : 'flex'
            } ${activeTab == 'stake' ? 'text-white' : 'text-primaryText'}`}
          >
            <FormattedMessage id="stake"></FormattedMessage>
            <div
              className={`absolute w-full -bottom-px left-0 h-1  rounded-full ${
                activeTab == 'stake' ? 'bg-greenColor' : ''
              }`}
            ></div>
          </div>
          <div
            onClick={() => {
              switchTab('unstake');
            }}
            className={`flex relative w-1/2 items-center text-lg py-3.5 pl-20 cursor-pointer ${
              !isSignedIn ? 'hidden' : ''
            } ${activeTab == 'unstake' ? 'text-white' : 'text-primaryText'}`}
          >
            <FormattedMessage id="unstake"></FormattedMessage>
            <div
              className={`absolute w-full -bottom-px left-0 h-1  rounded-full ${
                activeTab == 'unstake' ? 'bg-greenColor' : ''
              }`}
            ></div>
          </div>
        </div>
        {activeTab == 'stake' ? (
          <>
            <StakeArea
              detailData={detailData}
              tokenPriceList={tokenPriceList}
              cd_strategy={cd_strategy}
            ></StakeArea>
            <div className="mt-4">
              <SlashTip></SlashTip>
            </div>
          </>
        ) : null}
      </div>
      {isSignedIn ? (
        <StakedList
          activeTab={activeTab}
          detailData={detailData}
          tokenPriceList={tokenPriceList}
          cd_strategy={cd_strategy}
          serverTime={serverTime}
        ></StakedList>
      ) : null}
    </div>
  );
}
function SlashTip(props: any) {
  const { isHiddenText } = props;
  const intl = useIntl();
  const text1 = intl.formatMessage({ id: 'slash_policy' });
  const text2 = intl.formatMessage({ id: 'slash_policy_content' });
  const slash_policy_tip = () => {
    const result = `<div class='w-52 text-xs text-primaryText text-left'>
    <p>${text1}:</p>
    <p>${text2}</p>
 </div>`;
    return result;
  };
  return (
    <div className="flex items-center justify-center">
      {isHiddenText ? null : (
        <label className="text-sm text-farmText mr-1">
          <FormattedMessage id="slash_policy"></FormattedMessage>
        </label>
      )}

      <div
        className="text-white text-right ml-1"
        data-class="reactTip"
        data-for="slash_policy_id"
        data-place="top"
        data-html={true}
        data-tip={slash_policy_tip()}
      >
        <QuestionMark></QuestionMark>
        <ReactTooltip
          id="slash_policy_id"
          backgroundColor="#1D2932"
          border
          borderColor="#7e8a93"
          effect="solid"
        />
      </div>
    </div>
  );
}
function StakeArea(props: any) {
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [balance, setBalance] = useState('0');
  const [stakeAmountAvailableCheck, setStakeAmountAvailableCheck] =
    useState(true);
  const [stakeModalVisible, setStakeModalVisible] = useState(false);
  const [selected_cd_strategy, set_selected_cd_strategy] =
    useState<Record<string, string>>();
  const [select_cd_price, set_select_cd_price] = useState<string>();
  const [boosterSwitchOn, setBoosterSwitchOn] = useState(true);
  const { detailData, tokenPriceList, cd_strategy } = props;
  const seedId = detailData[0]['seed_id'];
  const pool = detailData[0]['pool'];
  const intl = useIntl();
  const { signedInState } = useContext(WalletContext);
  const isSignedIn = signedInState.isSignedIn;
  useEffect(() => {
    getStakeBalance(pool.id);
  }, []);
  useEffect(() => {
    if (cd_strategy) {
      set_selected_cd_strategy(cd_strategy[0]);
      const { realRate, month } = cd_strategy[0];
      getFuturePrices({
        num: Number(stakeAmount) * Number(realRate),
        time: month,
      });
    }
  }, [cd_strategy]);
  const getStakeBalance = async (id: string) => {
    const b = await mftGetBalance(getMftTokenId(id.toString()));
    if (STABLE_POOL_ID == id) {
      setBalance(toReadableNumber(LP_STABLE_TOKEN_DECIMALS, b));
    } else {
      setBalance(toReadableNumber(LP_TOKEN_DECIMALS, b));
    }
  };
  const changeAmount = (amount: string) => {
    const LIMITAOMUNT = '1000000000000000000';
    let value;
    if (STABLE_POOL_ID == pool.id) {
      value = toNonDivisibleNumber(LP_STABLE_TOKEN_DECIMALS, amount);
    } else {
      value = toNonDivisibleNumber(LP_TOKEN_DECIMALS, amount);
    }
    if (amount && new BigNumber(value).isLessThan(LIMITAOMUNT)) {
      setStakeAmountAvailableCheck(false);
    } else {
      setStakeAmountAvailableCheck(true);
    }
    setStakeAmount(amount);
    const { realRate, month } = selected_cd_strategy;
    getFuturePrices({ num: Number(amount) * Number(realRate), time: month });
  };
  function displayShares() {
    const seedTotalStakedAmount = detailData[0].seedTotalStakedAmount;
    if (!stakeAmount || new BigNumber(stakeAmount).isLessThanOrEqualTo('0')) {
      return (
        <>
          <label className="text-lg text-white">-</label>
          <label className="text-farmText text-sm ml-2.5">-%</label>
        </>
      );
    }
    const totalStake = new BigNumber(stakeAmount).plus(seedTotalStakedAmount);
    let percent = new BigNumber(stakeAmount)
      .dividedBy(totalStake)
      .multipliedBy(100);
    let resultPercent;
    if (new BigNumber('0.001').isGreaterThan(percent)) {
      resultPercent = '<0.001';
    } else {
      resultPercent = percent.toFixed(3, 1).toString();
    }
    let resultLpToken;
    if (new BigNumber('0.001').isGreaterThan(stakeAmount)) {
      resultLpToken = '<0.001';
    } else {
      resultLpToken = handleNumber(stakeAmount);
    }
    return (
      <>
        <label className="text-lg text-white">{resultLpToken}</label>
        <label className="text-farmText text-sm ml-2.5">{resultPercent}%</label>
      </>
    );
  }
  function handleNumber(number: string) {
    const temp = toInternationalCurrencySystem(number, 3);
    const length = temp.length;
    const left = temp.substring(0, length - 1);
    const right = temp.substring(length - 1);
    let result = temp;
    if (['K', 'M', 'B'].indexOf(right) > -1) {
      result = new BigNumber(left).toFixed() + right;
    }
    return result;
  }
  function clickSwitchButton() {
    setBoosterSwitchOn(!boosterSwitchOn);
    set_selected_cd_strategy(cd_strategy[0]);
    const { realRate, month } = cd_strategy[0];
    getFuturePrices({
      num: Number(stakeAmount) * Number(realRate),
      time: month,
    });
  }
  const isDisabled =
    !stakeAmount ||
    !stakeAmountAvailableCheck ||
    new BigNumber(stakeAmount).isLessThanOrEqualTo(0) ||
    new BigNumber(stakeAmount).isGreaterThan(balance);

  const getFuturePrices = (item: {
    num: string | number;
    time: string | number;
  }) => {
    const { num, time } = item;
    const lpTokenNum = num < 0 ? 0 : num;
    const day = Number(time) * 30;
    const rewardTemp: { tokenList: any[]; tokenTotalPrice: string } = {
      tokenList: [],
      tokenTotalPrice: '',
    };
    if (!lpTokenNum || new BigNumber(lpTokenNum).isEqualTo('0')) {
      set_select_cd_price('');
      return;
    }
    detailData.forEach((farm: any) => {
      const tokenTemp: any = Object.assign({}, farm.rewardToken);
      const {
        rewardsPerWeekAmount: rewardsPerWeek,
        seedTotalStakedAmount: seedAmount,
      } = farm;
      const totalStake = new BigNumber(lpTokenNum).plus(seedAmount).toString();
      const perDayAndLp = new BigNumber(rewardsPerWeek).dividedBy(
        new BigNumber(totalStake).multipliedBy(7)
      );
      let rewardTokenNum;
      if (perDayAndLp.isEqualTo('0')) {
        // totalStake reach to the max limit
        rewardTokenNum = new BigNumber(rewardsPerWeek)
          .dividedBy(7)
          .multipliedBy(day);
      } else {
        rewardTokenNum = perDayAndLp.multipliedBy(day).multipliedBy(lpTokenNum);
      }
      const priceData: any = tokenPriceList[tokenTemp.id];
      let tokenPrice = '0';
      if (priceData && priceData.price) {
        tokenPrice = new BigNumber(rewardTokenNum)
          .multipliedBy(priceData.price)
          .toString();
      }
      let resultRewardTokenNum;
      if (new BigNumber('0.001').isGreaterThan(rewardTokenNum)) {
        resultRewardTokenNum = '<0.001';
      } else {
        resultRewardTokenNum = toInternationalCurrencySystem(
          rewardTokenNum.toString(),
          3
        );
      }
      tokenTemp.num = resultRewardTokenNum;
      tokenTemp.tokenPrice = tokenPrice;
      rewardTemp.tokenList.push(tokenTemp);
      rewardTemp.tokenTotalPrice = new BigNumber(
        rewardTemp.tokenTotalPrice || '0'
      )
        .plus(tokenPrice)
        .toString();
    });
    // handle tokenTotalPrice display
    const tokenTotalPriceActual = rewardTemp.tokenTotalPrice;
    if (rewardTemp.tokenTotalPrice) {
      if (new BigNumber('0').isEqualTo(rewardTemp.tokenTotalPrice)) {
        rewardTemp.tokenTotalPrice = '$ -';
      } else if (
        new BigNumber('0.001').isGreaterThan(rewardTemp.tokenTotalPrice)
      ) {
        rewardTemp.tokenTotalPrice = '<$ 0.001';
      } else {
        rewardTemp.tokenTotalPrice = `$${toInternationalCurrencySystem(
          rewardTemp.tokenTotalPrice,
          3
        )}`;
      }
    }
    set_select_cd_price(rewardTemp.tokenTotalPrice);
  };
  const selectStrategy = (item: any) => {
    set_selected_cd_strategy(item);
    const { realRate, month } = item;
    getFuturePrices({
      num: Number(stakeAmount) * Number(realRate),
      time: month,
    });
  };
  return (
    <div>
      <StakeInputField
        balance={balance}
        changeAmount={changeAmount}
        amount={stakeAmount}
      ></StakeInputField>
      <div className="flex justify-between items-center my-2.5">
        <label className="text-farmText text-sm">
          <FormattedMessage id="my_shares"></FormattedMessage>
        </label>
        <span className="flex items-center">{displayShares()}</span>
      </div>
      <div className="bg-black bg-opacity-20 rounded-lg px-5 py-4">
        <div className="flex items-center justify-between w-full">
          <label className="text-white text text-xl">
            <FormattedMessage id="booster"></FormattedMessage>
          </label>
          <div className="flex items-center">
            <label className="text-sm text-farmText mr-2">
              <FormattedMessage id="stake_for"></FormattedMessage>
            </label>
            <span
              onClick={clickSwitchButton}
              style={{ width: '29px', height: '16px' }}
              className={`flex items-center rounded-2xl transition-all cursor-pointer px-px ${
                boosterSwitchOn
                  ? 'justify-end bg-switchButtonGradientBg'
                  : 'justify-start bg-farmSbg'
              }`}
            >
              <label
                style={{ width: '13px', height: '13px' }}
                className={`rounded-full cursor-pointer bg-white ${
                  boosterSwitchOn ? 'bg-white' : 'bg-farmRound'
                }`}
              ></label>
            </span>
          </div>
        </div>
        <div className={`mt-8 ${boosterSwitchOn ? '' : 'hidden'}`}>
          <div className="flex items-center justify-center h-24">
            {selected_cd_strategy?.icon}
            <div className="flex flex-col items-center ml-20">
              <label className="text-white text-3xl">
                x{selected_cd_strategy?.realRate}
              </label>
              <span className="text-white text-lg">
                <FormattedMessage id="Rewards"></FormattedMessage>
              </span>
            </div>
          </div>
          <div className="flex items-center mt-16 mb-12 pr-5 ml-5">
            {cd_strategy?.map((item: any, index: number) => {
              return (
                <div
                  key={index}
                  className={`flex items-center relative ${
                    index == 0 ? 'w-0' : 'w-1/' + (cd_strategy.length - 1)
                  }`}
                >
                  <div
                    style={{ height: '5px' }}
                    className={`rounded-lg w-full  ${
                      selected_cd_strategy?.index >= item.index
                        ? 'bg-greenColor'
                        : 'bg-darkBg'
                    }`}
                  ></div>
                  <div
                    className={`absolute right-0 flex flex-col items-center transform translate-x-1/2 z-10`}
                  >
                    <label
                      className={`text-white text-sm h-5 whitespace-nowrap ${
                        selected_cd_strategy?.index == item.index
                          ? 'visible'
                          : 'invisible'
                      }`}
                    >
                      {select_cd_price}
                    </label>
                    <span
                      onClick={() => {
                        selectStrategy(item);
                      }}
                      style={{ width: '21px', height: '21px' }}
                      className={`rounded-full my-2 cursor-pointer ${
                        selected_cd_strategy?.index >= item.index
                          ? 'bg-greenColor'
                          : 'bg-darkBg'
                      } `}
                    ></span>
                    <label
                      className={`text-sm whitespace-nowrap ${
                        index > 0 ? 'text-farmText' : 'text-white'
                      }`}
                    >
                      {item.month} Month
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-center mt-2">
        {!stakeAmountAvailableCheck ? (
          <Alert
            level="warn"
            message={
              STABLE_POOL_ID == pool.id
                ? intl.formatMessage({ id: 'more_than_stable_seed' })
                : intl.formatMessage({ id: 'more_than_general_seed' })
            }
          />
        ) : null}
      </div>
      {isSignedIn ? (
        <GradientButton
          onClick={() => {
            setStakeModalVisible(true);
          }}
          color="#fff"
          disabled={isDisabled}
          btnClassName={`${isDisabled ? 'cursor-not-allowed' : ''}`}
          className={`mt-6 w-full h-12 text-center text-base text-white focus:outline-none font-semibold ${
            isDisabled ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <FormattedMessage id="stake" defaultMessage="Stake" />
        </GradientButton>
      ) : (
        <ConnectToNearButton className="mt-6"></ConnectToNearButton>
      )}
      {stakeModalVisible ? (
        <StakeModal
          title="stake"
          isOpen={stakeModalVisible}
          onRequestClose={() => {
            setStakeModalVisible(false);
          }}
          detailData={detailData}
          amount={stakeAmount}
          strategy={selected_cd_strategy}
          boosterSwitchOn={boosterSwitchOn}
        ></StakeModal>
      ) : null}
    </div>
  );
}
function StakedList(props: any) {
  const { signedInState } = useContext(WalletContext);
  const isSignedIn = signedInState.isSignedIn;
  const [seedUserInfo, setSeedUserInfo] = useState<Record<string, any>>({});
  const [unclaimedRewardData, setUnclaimedRewardData] =
    useState<Record<string, any>>(null);
  const [hoverLine, setHoverLine] = useState<string | number>('');
  const { detailData, tokenPriceList, cd_strategy, serverTime, activeTab } =
    props;
  const [appendStakeModalVisible, setAppendStakeModalVisible] = useState(false);
  const [appendAccount, setAppendAccount] = useState();
  const seedId = detailData[0]['seed_id'];
  const pool = detailData[0]['pool'];
  const farm = detailData[0];
  const intl = useIntl();
  useEffect(() => {
    getUserSeedInfoBySeedId();
    getUnclaimedRewardData();
  }, []);
  function getUnclaimedRewardData() {
    const worth = getTotalUnclaimedRewardsWorth();
    const amountList = getTotalUnclaimedRewardsAmount();
    setUnclaimedRewardData({
      worth,
      amountList,
    });
  }
  function getTotalUnclaimedRewardsWorth() {
    let totalPrice = 0;
    detailData.forEach((farm: any) => {
      const { rewardToken, userUnclaimedRewardAmount } = farm;
      const tokenPrice = tokenPriceList[rewardToken.id].price;
      if (tokenPrice && tokenPrice != 'N/A') {
        totalPrice += +userUnclaimedRewardAmount * tokenPrice;
      }
    });
    return totalPrice;
  }
  function getTotalUnclaimedRewardsAmount() {
    const tempList = mergeCommonRewardsFarms();
    const lastList: any[] = [];
    tempList.forEach((arr: any[]) => {
      let totalUserUnclaimedReward = '0';
      arr.forEach((farm: any) => {
        totalUserUnclaimedReward = BigNumber.sum(
          totalUserUnclaimedReward,
          farm.userUnclaimedRewardAmount
        ).valueOf();
      });
      lastList.push({
        commonRewardToken: unWrapToken(arr[0].rewardToken,true),
        totalUserUnclaimedReward: totalUserUnclaimedReward,
      });
    });
    return lastList;
  }
  function mergeCommonRewardsFarms() {
    const tempMap = {};
    detailData.forEach((farm: any) => {
      const { rewardToken } = farm;
      tempMap[rewardToken.id] = tempMap[rewardToken.id] || [];
      tempMap[rewardToken.id].push(farm);
    });
    return Object.values(tempMap);
  }
  const getUserSeedInfoBySeedId = async () => {
    const seedUserInfo = await get_user_seed_info_by_seedId({ seedId: seedId });
    if (seedUserInfo) {
      const { cds = [], amount, seed_id } = seedUserInfo;
      let freeAmount = new BigNumber(amount);
      cds.forEach((item: any) => {
        const { seed_amount } = item;
        freeAmount = freeAmount.minus(seed_amount);
      });
      seedUserInfo.free = {
        seed_amount: freeAmount.toFixed(),
        seed_power: freeAmount.toFixed(),
        seed_id,
        isFree: true,
      };
      setSeedUserInfo(seedUserInfo);
    }
  };
  const displayStakedShares = (curAmount: string) => {
    const { power, amount } = seedUserInfo;
    const DECIMALS =
      STABLE_POOL_ID == pool.id ? LP_STABLE_TOKEN_DECIMALS : LP_TOKEN_DECIMALS;
    const v = toReadableNumber(DECIMALS, curAmount);
    const p = new BigNumber(v)
      .dividedBy(farm.seedTotalStakedAmount)
      .multipliedBy(100);
    const vAmount = toPrecision(v, 6);
    let percentage = '';
    if (new BigNumber(0.001).isGreaterThan(p)) {
      percentage = '(<0.001%)';
    } else {
      percentage = `${toPrecision(p.toString(), 2)}%`;
    }
    return (
      <>
        <label className="text-white text-lg">{vAmount}</label>
        <label className="text-farmText text-sm ml-1.5">{percentage}</label>
      </>
    );
  };
  const displayUnClaimedUi = (account: any) => {
    const { seed_power } = account;
    const total_power = seedUserInfo.power;
    const percent = new BigNumber(seed_power).dividedBy(total_power).toString();
    const { worth, amountList } = unclaimedRewardData;
    const curWorth = new BigNumber(worth).multipliedBy(percent).toString();
    let displayCurWorth = '';
    if (new BigNumber(0).isEqualTo(curWorth)) {
      displayCurWorth = '-';
    } else if (new BigNumber('0.01').isGreaterThan(curWorth)) {
      displayCurWorth = '<$0.01';
    } else {
      displayCurWorth = `$${toInternationalCurrencySystem(
        curWorth.toString(),
        2
      )}`;
    }
    const displayAmountList: any[] = [];
    amountList.forEach((item: any) => {
      const { totalUserUnclaimedReward, commonRewardToken } = item;
      const curUserUnclaimedReward = new BigNumber(totalUserUnclaimedReward)
        .multipliedBy(percent)
        .toString();
      let displayNum;
      if (
        !curUserUnclaimedReward ||
        new BigNumber('0').isEqualTo(curUserUnclaimedReward)
      ) {
        displayNum = '-';
      } else if (new BigNumber('0.001').isGreaterThan(curUserUnclaimedReward)) {
        displayNum = '<0.001';
      } else {
        displayNum = new BigNumber(curUserUnclaimedReward).toFixed(3, 1);
      }
      displayAmountList.push({
        commonRewardToken,
        displayNum: formatWithCommas(displayNum),
      });
    });

    return (
      <>
        <label className="text-white text-sm">{displayCurWorth}</label>
        <div className="flex items-center mt-2 flex-wrap justify-end">
          {displayAmountList.map((item, index) => {
            return (
              <span
                key={index}
                className="flex items-center text-white text-sm mr-2.5 mb-2"
              >
                <img
                  src={item.commonRewardToken.icon}
                  className="w-5 h-5 rounded-full border border-greenColor"
                ></img>
                <label className="ml-1.5 mr-2.5">{item.displayNum}</label>
                {index == displayAmountList.length - 1 ? null : (
                  <label>+</label>
                )}
              </span>
            );
          })}
        </div>
      </>
    );
  };
  const displayCdRate = (item: any) => {
    let result = '-';
    if (cd_strategy) {
      const { begin_sec, end_sec, seed_amount, seed_power } = item;
      result = new BigNumber(seed_power).dividedBy(seed_amount).toFixed();
      result = toPrecision(result.toString(), 6);
      // const month = (new BigNumber(end_sec).minus(begin_sec)).dividedBy(30*24*60*60).toFixed();
      // const targetCdStrategy = cd_strategy.find((m:any) => {
      //   if (m.month == month) return true;
      // })
      // if (targetCdStrategy) {
      //   result = targetCdStrategy.realRate;
      // }
    }
    return result;
  };
  const displayStakeTime = (item: any) => {
    const { begin_sec, end_sec } = item;
    const startDate = new Date(begin_sec * 1000).toString();
    const endDate = new Date(end_sec * 1000).toString();
    const startArr = startDate.split(' ');
    const endArr = endDate.split(' ');
    const startDisplay = `${startArr[2]} ${startArr[1]}, ${startArr[3]}`;
    const endDisplay = `${endArr[2]} ${endArr[1]}, ${endArr[3]}`;
    const hm = endArr[4].substring(0, 5);
    return `<span class="text-farmText text-xs">${hm} ${startDisplay} - ${endDisplay}</span>`;
  };
  const displayProgress = (item: any) => {
    let result = {
      percent: '0%',
      text: '-',
    };
    if (serverTime) {
      const { begin_sec, end_sec } = item;
      const month = new BigNumber(end_sec)
        .minus(begin_sec)
        .dividedBy(30 * 24 * 60 * 60)
        .toFixed();
      const serverTime_sed = new BigNumber(serverTime)
        .dividedBy(1000)
        .toFixed();
      const totalPeriod = new BigNumber(end_sec).minus(begin_sec);
      const pastPeriod = new BigNumber(serverTime_sed).minus(begin_sec);
      const percent = pastPeriod
        .dividedBy(totalPeriod)
        .multipliedBy(100)
        .toFixed(2, 1);
      let displayPercent = percent;
      if (percent < '0.01') {
        displayPercent = '<0.01';
      }
      result.percent = percent + '%';
      result.text = `${displayPercent}% of ${month} months`;
    }
    return result;
  };
  const openAppendStakeModal = (item: any) => {
    setAppendStakeModalVisible(true);
    setAppendAccount(item);
  };
  const closeAppendStakeModal = (item: any) => {
    setAppendStakeModalVisible(false);
    setAppendAccount(null);
  };
  const booster_change_reason = intl.formatMessage({
    id: 'booster_change_reason',
  });
  return (
    <div
      className={`stakedBox relative bg-cardBg  px-7 py-3 ${
        activeTab == 'stake' ? 'rounded-2xl mt-3' : '-mt-9'
      }`}
    >
      <div className={`titie mb-1.5 ${activeTab == 'stake' ? '' : 'hidden'}`}>
        <div className="text-white text-base py-3">
          <FormattedMessage id="staked_only"></FormattedMessage>
        </div>
        <div className="line h-0.5 bg-black bg-opacity-20 rounded-full"></div>
      </div>
      {seedUserInfo.free && (
        <div className="mt-3 px-3 pb-5 pt-px bg-black bg-opacity-20 rounded-lg">
          <CommonLine title="my_shares">
            <span className="flex items-center">
              {displayStakedShares(seedUserInfo.free['seed_amount'])}
            </span>
          </CommonLine>
          <CommonLine title="rewards" style={{ alignItems: 'flex-start' }}>
            <div className="flex flex-col items-end">
              {displayUnClaimedUi(seedUserInfo.free)}
            </div>
          </CommonLine>
          <CommonLine title="stake_period">
            <label className="text-white text-sm">
              <FormattedMessage id="free"></FormattedMessage>
            </label>
          </CommonLine>
          <CommonLine title="booster">
            <label className="text-white text-sm">-</label>
          </CommonLine>
          {activeTab == 'stake' ? (
            <div className="flex justify-end pt-4">
              <GradientButton
                onClick={() => {
                  openAppendStakeModal(seedUserInfo.free);
                }}
                color="#fff"
                className={`w-24 h-8 text-center text-base text-white focus:outline-none font-semibold `}
              >
                <FormattedMessage id="append" defaultMessage="Append" />
              </GradientButton>
            </div>
          ) : (
            <UnStakeInputField
              detailData={detailData}
              account={seedUserInfo.free}
              serverTime={serverTime}
              unclaimedRewardData={unclaimedRewardData}
              seedUserInfo={seedUserInfo}
            ></UnStakeInputField>
          )}
        </div>
      )}
      {seedUserInfo?.cds?.map((item: any, index: number) => {
        return (
          <div
            key={index}
            className="mt-3 px-3 pb-5 pt-px bg-black bg-opacity-20 rounded-lg"
          >
            <CommonLine title="my_shares">
              <span className="flex items-center">
                {displayStakedShares(item['seed_amount'])}
              </span>
            </CommonLine>
            <CommonLine title="rewards" style={{ alignItems: 'flex-start' }}>
              <div className="flex flex-col items-end">
                {displayUnClaimedUi(item)}
              </div>
            </CommonLine>
            <CommonLine title="stake_period">
              <div className="flex items-center">
                <div
                  className="text-white text-right"
                  data-class="reactTip"
                  data-for="staked_time_id"
                  data-place="top"
                  data-html={true}
                  data-tip={displayStakeTime(item)}
                >
                  <div
                    style={{ width: '210px', height: '5px' }}
                    className="relative rounded-lg bg-darkBg mr-3.5"
                    onMouseOver={() => {
                      setHoverLine(item.cd_account_id);
                    }}
                    onMouseLeave={() => {
                      setHoverLine('');
                    }}
                  >
                    <div
                      className={`absolute h-full rounded-lg left-0 top-0 ${
                        hoverLine === item.cd_account_id
                          ? 'bg-greenColor'
                          : 'bg-lightBg'
                      }`}
                      style={{ width: displayProgress(item).percent }}
                    ></div>
                  </div>
                  <ReactTooltip
                    id="staked_time_id"
                    backgroundColor="#1D2932"
                    border
                    borderColor="#7e8a93"
                    effect="solid"
                  />
                </div>
                <span className="text-white text-sm">
                  {displayProgress(item).text}
                </span>
              </div>
            </CommonLine>
            <CommonLine title="booster">
              <span className="flex items-center">
                <label className="text-white text-sm">
                  x{displayCdRate(item)}
                </label>
                <div
                  className="text-white text-right ml-1"
                  data-class="reactTip"
                  data-for="booster_id"
                  data-place="top"
                  data-html={true}
                  data-tip={`<div class="w-40 text-farmText text-xs text-left">${booster_change_reason}</div>`}
                >
                  <QuestionMark></QuestionMark>
                  <ReactTooltip
                    id="booster_id"
                    backgroundColor="#1D2932"
                    border
                    borderColor="#7e8a93"
                    effect="solid"
                  />
                </div>
              </span>
            </CommonLine>
            {activeTab == 'stake' ? (
              <div className="flex justify-end pt-4">
                <GradientButton
                  onClick={() => {
                    openAppendStakeModal(item);
                  }}
                  color="#fff"
                  className={`w-24 h-8 text-center text-base text-white focus:outline-none font-semibold `}
                >
                  <FormattedMessage id="append" defaultMessage="Append" />
                </GradientButton>
              </div>
            ) : (
              <UnStakeInputField
                detailData={detailData}
                account={item}
                serverTime={serverTime}
                unclaimedRewardData={unclaimedRewardData}
                seedUserInfo={seedUserInfo}
              ></UnStakeInputField>
            )}
          </div>
        );
      })}
      {activeTab == 'stake' ? null : (
        <div className="mt-4">
          <SlashTip></SlashTip>
        </div>
      )}
      {appendStakeModalVisible ? (
        <AppendStakeModal
          title="append_staking"
          isOpen={appendStakeModalVisible}
          detailData={detailData}
          account={appendAccount}
          cd_strategy={cd_strategy}
          onRequestClose={closeAppendStakeModal}
        ></AppendStakeModal>
      ) : null}
    </div>
  );
}

function UnstakeList() {
  return (
    <div>
      {[1, 2, 3].map((item) => {
        return (
          <div
            key={item}
            className="mt-3 px-3 pb-5 pt-px bg-black bg-opacity-20 rounded-lg"
          >
            <CommonLine title="my_shares">
              <span className="flex items-center">
                <label className="text-white text-lg">30</label>
                <label className="text-farmText text-sm ml-1.5">0.13%</label>
              </span>
            </CommonLine>
            <CommonLine title="rewards">
              <div className="flex flex-col items-end">
                <label className="text-white text-sm">$352.02</label>
                <div className="flex items-center mt-2">
                  <span className="flex items-center text-white text-sm mr-2.5">
                    <img src="" className="w-5 h-5 rounded-full"></img>
                    <label className="ml-1.5 mr-2.5">62.291</label>
                    <label>+</label>
                  </span>
                  <span className="flex items-center text-white text-sm mr-2.5">
                    <img src="" className="w-5 h-5 rounded-full"></img>
                    <label className="ml-1.5 mr-2.5">62.291</label>
                    <label>+</label>
                  </span>
                  <span className="flex items-center text-white text-sm">
                    <img src="" className="w-5 h-5 rounded-full"></img>
                    <label className="ml-1.5">62.291</label>
                  </span>
                </div>
              </div>
            </CommonLine>
            <CommonLine title="stake_period">
              <div className="flex items-center">
                <div
                  className="text-white text-right"
                  data-class="reactTip"
                  data-for="staked_time_id"
                  data-place="top"
                  data-html={true}
                  data-tip={
                    '<span class="text-farmText text-xs">18:03 Jan 01, 2022 - Jun 01, 2022</span>'
                  }
                >
                  <div
                    style={{ width: '210px', height: '5px' }}
                    className="relative rounded-lg bg-darkBg mr-3.5"
                  >
                    <div
                      className="absolute h-full rounded-lg left-0 top-0 bg-lightBg"
                      style={{ width: '35%' }}
                    ></div>
                  </div>
                  <ReactTooltip
                    id="staked_time_id"
                    backgroundColor="#1D2932"
                    border
                    borderColor="#7e8a93"
                    effect="solid"
                  />
                </div>
                <span className="text-white text-sm">32% of 6 months</span>
              </div>
            </CommonLine>
            <div className="flex items-center mt-4">
              <UnstakeInput></UnstakeInput>
              <div>
                {/* <GradientButton
                  color="#fff"
                  className={`w-24 h-10 text-center text-base text-white focus:outline-none font-semibold `}
                >
                  <FormattedMessage id="unstake" defaultMessage="Unstake" />
                </GradientButton> */}
                <OprationButton
                  color="#fff"
                  className={`w-24 h-10 text-center text-base text-white focus:outline-none font-semibold `}
                >
                  <LockedIcon></LockedIcon>
                </OprationButton>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function AppendStakeModal(props: any) {
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [balance, setBalance] = useState('0');
  const [stakeAmountAvailableCheck, setStakeAmountAvailableCheck] =
    useState(true);
  const [appendStakeLoading, setAppendStakeLoading] = useState(false);
  const [serverTime, setServerTime] = useState<string | number>();
  const [error, setError] = useState<Error>();
  const { detailData, account, cd_strategy } = props;
  const pool = detailData[0].pool;
  const intl = useIntl();
  const changeAmount = (amount: string) => {
    const LIMITAOMUNT = '1000000000000000000';
    let value;
    if (STABLE_POOL_ID == pool.id) {
      value = toNonDivisibleNumber(LP_STABLE_TOKEN_DECIMALS, amount);
    } else {
      value = toNonDivisibleNumber(LP_TOKEN_DECIMALS, amount);
    }
    if (amount && new BigNumber(value).isLessThan(LIMITAOMUNT)) {
      setStakeAmountAvailableCheck(false);
    } else {
      setStakeAmountAvailableCheck(true);
    }
    setStakeAmount(amount);
  };
  useEffect(() => {
    getStakeBalance(pool.id);
    get_server_time();
  }, []);
  const get_server_time = async () => {
    const timestamp = await getServerTime();
    const serverTime = new BigNumber(timestamp)
      .dividedBy(1000000)
      .toFixed(0, 1);
    setServerTime(serverTime);
  };
  const getStakeBalance = async (id: string) => {
    const b = await mftGetBalance(getMftTokenId(id.toString()));
    if (STABLE_POOL_ID == id) {
      setBalance(toReadableNumber(LP_STABLE_TOKEN_DECIMALS, b));
    } else {
      setBalance(toReadableNumber(LP_TOKEN_DECIMALS, b));
    }
  };
  function displayShares() {
    const seedTotalStakedAmount = detailData[0].seedTotalStakedAmount;
    if (!stakeAmount || new BigNumber(stakeAmount).isLessThanOrEqualTo('0')) {
      return (
        <>
          <label className="text-lg text-white">-</label>
          <label className="text-farmText text-sm ml-2.5">-%</label>
        </>
      );
    }
    const totalStake = new BigNumber(stakeAmount).plus(seedTotalStakedAmount);
    let percent = new BigNumber(stakeAmount)
      .dividedBy(totalStake)
      .multipliedBy(100);
    let resultPercent;
    if (new BigNumber('0.001').isGreaterThan(percent)) {
      resultPercent = '<0.001';
    } else {
      resultPercent = percent.toFixed(3, 1).toString();
    }
    let resultLpToken;
    if (new BigNumber('0.001').isGreaterThan(stakeAmount)) {
      resultLpToken = '<0.001';
    } else {
      resultLpToken = handleNumber(stakeAmount);
    }
    return (
      <>
        <label className="text-lg text-white">{resultLpToken}</label>
        <label className="text-farmText text-sm ml-2.5">{resultPercent}%</label>
      </>
    );
  }
  function handleNumber(number: string) {
    const temp = toInternationalCurrencySystem(number, 3);
    const length = temp.length;
    const left = temp.substring(0, length - 1);
    const right = temp.substring(length - 1);
    let result = temp;
    if (['K', 'M', 'B'].indexOf(right) > -1) {
      result = new BigNumber(left).toFixed() + right;
    }
    return result;
  }
  function displayBooster() {
    let result = <label className="text-white text-lg">-</label>;
    const { isFree } = account;
    if (!isFree && serverTime) {
      const { begin_sec, end_sec, cd_account_id, seed_amount, seed_power } =
        account;
      const percent_time = new BigNumber(serverTime)
        .dividedBy(end_sec * 1000)
        .toFixed();
      const lock_sec = end_sec - begin_sec;
      const selected_cd_strategy = cd_strategy.filter((item: any) => {
        if (item.lock_sec == lock_sec) return true;
      });
      const initial_rate = selected_cd_strategy[0]?.power_reward_rate / 10000;
      const displayRealRate = new BigNumber(percent_time)
        .multipliedBy(initial_rate)
        .plus(1)
        .toFixed(5, 1);
      result = (
        <>
          <label className="text-white text-lg">x {displayRealRate}</label>
          <span className="rounded-2xl bg-black bg-opacity-20 text-farmText text-sm px-3 py-1.5 mt-1.5">
            <FormattedMessage id="initial_booster" /> {initial_rate} x{' '}
            <FormattedMessage id="append_timing" />{' '}
            {toPrecision(percent_time, 2)}
          </span>
        </>
      );
    }
    return result;
  }
  function displayTime() {
    let result = intl.formatMessage({ id: 'anytime' });
    const { isFree } = account;
    if (!isFree) {
      const { end_sec } = account;
      const endLineArr = (
        new Date(Number(end_sec * 1000)).toString() || ''
      ).split(' ');
      result = `${endLineArr[2]} ${endLineArr[1]}, ${endLineArr[3]}`;
    }
    return result;
  }
  const appendStake = () => {
    setAppendStakeLoading(true);
    const DECIMALS =
      STABLE_POOL_ID == pool.id ? LP_STABLE_TOKEN_DECIMALS : LP_TOKEN_DECIMALS;
    const { cd_account_id, isFree } = account;
    let msg = '';
    if (!isFree) {
      msg = JSON.stringify({ AppendCDAccount: { index: cd_account_id } });
    }
    stake_v2({
      token_id: getMftTokenId(pool.id),
      amount: toNonDivisibleNumber(DECIMALS, stakeAmount),
      msg,
    }).catch((err: any) => {
      setError(err);
      setAppendStakeLoading(false);
    });
  };
  const isDisabled =
    !stakeAmount ||
    !stakeAmountAvailableCheck ||
    new BigNumber(stakeAmount).isLessThanOrEqualTo(0) ||
    new BigNumber(stakeAmount).isGreaterThan(balance);
  return (
    <CommonModal {...props}>
      <StakeInputField
        balance={balance}
        changeAmount={changeAmount}
        amount={stakeAmount}
      ></StakeInputField>
      <div className="flex justify-between items-center mt-4">
        <label className="text-farmText text-sm">
          <FormattedMessage id="my_shares"></FormattedMessage>
        </label>
        <span className="flex items-center">{displayShares()}</span>
      </div>
      <div className="flex justify-between items-start mt-4">
        <label className="text-farmText text-sm">
          <FormattedMessage id="booster"></FormattedMessage>
        </label>
        <span className="flex flex-col items-end">{displayBooster()}</span>
      </div>
      <div className="flex justify-between items-center mt-4">
        <label className="text-farmText text-sm">
          <FormattedMessage id="unstake_time"></FormattedMessage>
        </label>
        <span className="flex items-center">
          <label className="text-white text-lg">{displayTime()}</label>
        </span>
      </div>
      <GradientButton
        onClick={appendStake}
        color="#fff"
        disabled={appendStakeLoading || isDisabled}
        loading={appendStakeLoading}
        btnClassName={`${isDisabled ? 'cursor-not-allowed' : ''}`}
        className={`w-full h-12 mt-6 text-center text-base text-white focus:outline-none font-semibold ${
          isDisabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
      >
        <div>
          <ButtonTextWrapper
            loading={appendStakeLoading}
            Text={() => (
              <FormattedMessage id="append" defaultMessage="Append" />
            )}
          />
        </div>
      </GradientButton>
    </CommonModal>
  );
}
function StakeModal(props: any) {
  const { detailData, amount, strategy, boosterSwitchOn } = props;
  const [serverTime, setServerTime] = useState<string | number>();
  const [error, setError] = useState<Error>();
  const [stakeLoading, setStakeLoading] = useState<boolean>(false);
  const [user_cd_account_list, set_ser_cd_account_list] = useState<any[]>([]);
  const pool = detailData[0].pool;
  const tokens = useTokens(pool.token_account_ids) || [];
  useEffect(() => {
    get_server_time();
    get_user_cd_account_list();
  }, []);
  const get_user_cd_account_list = async () => {
    const list = await list_user_cd_account();
    set_ser_cd_account_list(list);
  };
  const get_server_time = async () => {
    const timestamp = await getServerTime();
    const serverTime = new BigNumber(timestamp)
      .dividedBy(1000000)
      .toFixed(0, 1);
    setServerTime(serverTime);
  };
  const displaySymbols = () => {
    const symbols = pool?.token_symbols || [];
    let result = '';
    symbols.forEach((item: string, index: number) => {
      if (index == symbols.length - 1) {
        result += item;
      } else {
        result += item + '-';
      }
    });
    return result;
  };
  const displayImgs = () => {
    const tokenList: any[] = [];
    (tokens || []).forEach((token: any, index) => {
      tokenList.push(
        <img
          key={token.id}
          src={token.icon}
          className="w-5 h-5 rounded-full border border-greenColor outline-none -ml-1.5"
        ></img>
      );
    });
    return tokenList;
  };
  const displayMonth = () => {
    let result = '-';
    if (boosterSwitchOn) {
      const { month } = strategy;
      result = `${month} Months`;
    }
    return result;
  };
  const displayRate = () => {
    let result = '-';
    if (boosterSwitchOn) {
      const { realRate } = strategy;
      result = `x ${realRate}`;
    }
    return result;
  };
  const displayLastTime = () => {
    let result = '-';
    if (boosterSwitchOn && serverTime) {
      const { lock_sec } = strategy;
      const endLineTime = new BigNumber(lock_sec * 1000)
        .plus(serverTime)
        .toFixed();
      const endLineArr = (new Date(Number(endLineTime)).toString() || '').split(
        ' '
      );
      result = `${endLineArr[2]} ${endLineArr[1]}, ${endLineArr[3]}`;
    }
    return result;
  };
  function stake() {
    setStakeLoading(true);
    const DECIMALS =
      STABLE_POOL_ID == pool.id ? LP_STABLE_TOKEN_DECIMALS : LP_TOKEN_DECIMALS;
    const cdIndex = user_cd_account_list.length;
    const strategyIndex = strategy.index;
    let msg = '';
    if (boosterSwitchOn) {
      msg = JSON.stringify({
        NewCDAccount: { index: cdIndex, cd_strategy: strategyIndex },
      });
    }
    stake_v2({
      token_id: getMftTokenId(pool.id),
      amount: toNonDivisibleNumber(DECIMALS, amount),
      msg,
    }).catch((err: any) => {
      setError(err);
      setStakeLoading(false);
    });
  }
  return (
    <CommonModal {...props}>
      <CommonLine title="farm">
        <span className="flex items-center">
          <label className="text-white text-lg">{displaySymbols()}</label>
        </span>
      </CommonLine>
      <CommonLine title="reward_Token">
        <span className="flex items-center">{displayImgs()}</span>
      </CommonLine>
      <CommonLine title="stake">
        <span className="flex items-center">
          <label className="text-white text-lg">{amount}</label>
        </span>
      </CommonLine>
      <CommonLine title="stake_for">
        <span className="flex items-center">
          <label className="text-white text-lg">{displayMonth()}</label>
        </span>
      </CommonLine>
      <CommonLine title="booster">
        <span className="flex items-center">
          <label className="text-white text-lg">{displayRate()}</label>
        </span>
      </CommonLine>
      <CommonLine title="unstake_time">
        <span className="flex items-center">
          <label className="text-white text-lg">{displayLastTime()}</label>
        </span>
      </CommonLine>
      <GradientButton
        onClick={stake}
        color="#fff"
        disabled={stakeLoading}
        loading={stakeLoading}
        className={`w-full h-12 mt-6 text-center text-base text-white focus:outline-none font-semibold `}
      >
        <div>
          <ButtonTextWrapper
            loading={stakeLoading}
            Text={() => <FormattedMessage id="stake" defaultMessage="Stake" />}
          />
        </div>
      </GradientButton>
    </CommonModal>
  );
}
function UnStakeModal(props: any) {
  const { detailData, account, amount, unclaimedRewardData, seedUserInfo } =
    props;
  const [serverTime, setServerTime] = useState<string | number>();
  const [seedDetail, setSeedDetail] = useState<Record<string, any>>(null);
  const [acceptSlashPolicy, setAcceptSlashPolicy] = useState<boolean>(false);
  const [unStakeLoading, setUnStakeLoading] = useState<boolean>(
    !account.isFree
  );
  const [error, setError] = useState<Error>();
  /** 1:free 2:not expired 3:expired */
  const [status, setStatus] = useState<string | number>();
  const pool = detailData[0].pool;
  const seedId = detailData[0]['seed_id'];
  const intl = useIntl();
  useEffect(() => {
    if (!account.isFree) {
      getCdInfo();
    }
  }, []);
  const getCdInfo = async () => {
    const pro1 = get_seed_info(seedId);
    const pro2 = getServerTime();
    const resolved = await Promise.all([pro1, pro2]);
    const [seedInfo, timestamp] = resolved;
    const serverTime = new BigNumber(timestamp)
      .dividedBy(1000000)
      .toFixed(0, 1);
    const { isFree, end_sec } = account;
    let status;
    if (isFree) {
      status = 1;
    }
    if (!isFree) {
      if (new BigNumber(end_sec * 1000).isGreaterThan(serverTime)) {
        status = 2;
      } else {
        status = 3;
      }
    }
    setServerTime(serverTime);
    setStatus(status);
    setSeedDetail(seedInfo);
    setUnStakeLoading(false);
  };
  const displaySymbols = () => {
    const symbols = pool?.token_symbols || [];
    let result = '';
    symbols.forEach((item: string, index: number) => {
      if (index == symbols.length - 1) {
        result += item;
      } else {
        result += item + '-';
      }
    });
    return result;
  };
  const displayLastTime = () => {
    const txt = intl.formatMessage({ id: 'anytime' });
    let result = '';
    const { isFree, end_sec } = account;
    if (isFree) {
      result = txt;
    }
    if (!isFree && serverTime) {
      const endLineArr = (new Date(end_sec * 1000).toString() || '').split(' ');
      result = `${endLineArr[2]} ${endLineArr[1]}, ${endLineArr[3]}`;
    }
    return result;
  };
  const displayShares = () => {
    const { seed_amount } = account;
    const DECIMALS =
      STABLE_POOL_ID == pool.id ? LP_STABLE_TOKEN_DECIMALS : LP_TOKEN_DECIMALS;
    const v = toReadableNumber(DECIMALS, seed_amount);
    return v;
  };
  const displayStatus = () => {
    const txt = intl.formatMessage({ id: 'not_expired' });
    let result: any = '-';
    switch (+status) {
      case 1:
        result = 'Free';
        break;
      case 2:
        result = <label className="text-redwarningColor">{txt}</label>;
        break;
      case 3:
        result = 'expired';
        break;
      default:
        result = '-';
    }
    return result;
  };
  const displayValueOfRewards = () => {
    const { seed_power } = account;
    const total_power = seedUserInfo.power;
    const percent = new BigNumber(seed_power).dividedBy(total_power).toString();
    const { worth, amountList } = unclaimedRewardData;
    const curWorth = new BigNumber(worth).multipliedBy(percent).toString();
    let displayCurWorth = '';
    if (new BigNumber(0).isEqualTo(curWorth)) {
      displayCurWorth = '-';
    } else if (new BigNumber('0.01').isGreaterThan(curWorth)) {
      displayCurWorth = '<$0.01';
    } else {
      displayCurWorth = `$${toInternationalCurrencySystem(
        curWorth.toString(),
        2
      )}`;
    }
    return displayCurWorth;
  };
  const displayREwardsUi = () => {
    const { seed_power } = account;
    const total_power = seedUserInfo.power;
    const percent = new BigNumber(seed_power).dividedBy(total_power).toString();
    const { worth, amountList } = unclaimedRewardData;
    const displayAmountList: any[] = [];
    amountList.forEach((item: any) => {
      const { totalUserUnclaimedReward, commonRewardToken } = item;
      const curUserUnclaimedReward = new BigNumber(totalUserUnclaimedReward)
        .multipliedBy(percent)
        .toString();
      let displayNum;
      if (
        !curUserUnclaimedReward ||
        new BigNumber('0').isEqualTo(curUserUnclaimedReward)
      ) {
        displayNum = '-';
      } else if (new BigNumber('0.001').isGreaterThan(curUserUnclaimedReward)) {
        displayNum = '<0.001';
      } else {
        displayNum = new BigNumber(curUserUnclaimedReward).toFixed(3, 1);
      }
      displayAmountList.push({
        commonRewardToken,
        displayNum: formatWithCommas(displayNum),
      });
    });

    return (
      <>
        {displayAmountList.map((item, index) => {
          return (
            <span
              key={index}
              className="flex items-center text-white text-sm mr-2.5 mb-2"
            >
              <img
                src={item?.commonRewardToken?.icon}
                className="w-5 h-5 rounded-full border border-greenColor"
              ></img>
              <label className="ml-1.5 mr-2.5">{item.displayNum}</label>
              {index == displayAmountList.length - 1 ? null : <label>+</label>}
            </span>
          );
        })}
      </>
    );
  };
  const get_slash_lp_amount = () => {
    const result: any = {};
    if (seedDetail && serverTime) {
      const { slash_rate } = seedDetail;
      const rate = slash_rate / 10000;
      const originalLp = amount;
      const { begin_sec, end_sec } = account;
      const total_sec = (end_sec - begin_sec) * 1000;
      const rest_sec = Math.max(end_sec * 1000 - Number(serverTime), 0);
      const timeRate = rest_sec / total_sec;
      const needToPayAmount = rate * timeRate * Number(originalLp);
      const restAmount = new BigNumber(originalLp)
        .minus(needToPayAmount)
        .toFixed();
      if (needToPayAmount < 0.001) {
        result.payAmout = '<0.001';
      } else {
        result.payAmout = toPrecision(needToPayAmount.toString(), 3);
      }
      if (new BigNumber(restAmount).isLessThan(0.001)) {
        result.receivedAmount = '<0.001';
      } else {
        result.receivedAmount = toPrecision(restAmount, 3);
      }
    }
    return result;
  };
  const unStake = () => {
    setUnStakeLoading(true);
    const DECIMALS =
      STABLE_POOL_ID == pool.id ? LP_STABLE_TOKEN_DECIMALS : LP_TOKEN_DECIMALS;
    const realAmount = toNonDivisibleNumber(DECIMALS, amount);
    if (account.isFree) {
      unstake_v2_free({
        seed_id: seedId,
        amount: realAmount,
      }).catch((err) => {
        setError(err);
        setUnStakeLoading(false);
      });
    } else {
      unstake_v2_cd({
        index: account.cd_account_id,
        amount: realAmount,
      }).catch((err) => {
        setError(err);
        setUnStakeLoading(false);
      });
    }
  };
  const isDisabled = !account.isFree && !acceptSlashPolicy;
  return (
    <CommonModal {...props}>
      <CommonLine title="farm">
        <span className="flex items-center">
          <label className="text-white text-lg">{displaySymbols()}</label>
        </span>
      </CommonLine>
      <CommonLine title="my_shares">
        <span className="flex items-center">
          <label className="text-white text-lg">{amount}</label>
        </span>
      </CommonLine>
      <CommonLine title="unstake_time">
        <span className="flex items-center">
          <label className="text-white text-lg">{displayLastTime()}</label>
        </span>
      </CommonLine>
      <CommonLine title="status">
        <span className="flex items-center">
          <label className="text-white text-lg">{displayStatus()}</label>
        </span>
      </CommonLine>
      <CommonLine title="value_of_rewards">
        <span className="flex items-center">
          <label className="text-white text-lg">
            {displayValueOfRewards()}
          </label>
        </span>
      </CommonLine>
      <CommonLine title="Rewards" style={{ alignItems: 'flex-start' }}>
        <div className="flex items-center justify-end flex-end flex-wrap">
          {displayREwardsUi()}
        </div>
      </CommonLine>
      {status == 2 ? (
        <>
          <CommonLine title="lp_tokens">
            <span className="flex items-center">
              <label className="text-white text-lg">
                {get_slash_lp_amount().receivedAmount}
              </label>
            </span>
          </CommonLine>
          <div className="flex items-center justify-center rounded-md border border-redwarningColor py-4 px-2 mt-6">
            <ErrorTriangle></ErrorTriangle>
            <label className="text-base text-redwarningColor ml-3">
              <FormattedMessage id="you_will_pay" />{' '}
              {get_slash_lp_amount().payAmout}{' '}
              <FormattedMessage id="lp_token_slash" />.
            </label>
          </div>
        </>
      ) : null}
      <GradientButton
        onClick={unStake}
        color="#fff"
        disabled={unStakeLoading || isDisabled}
        loading={unStakeLoading}
        className={`w-full h-12 mt-6 text-center text-base text-white focus:outline-none font-semibold ${
          isDisabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
      >
        <div>
          <ButtonTextWrapper
            loading={unStakeLoading}
            Text={() => (
              <FormattedMessage id="unstake" defaultMessage="Unstake" />
            )}
          />
        </div>
      </GradientButton>
      {status == 2 ? (
        <div className="flex items-center justify-start mt-4">
          <span
            className="mr-3 cursor-pointer"
            onClick={() => {
              setAcceptSlashPolicy(!acceptSlashPolicy);
            }}
          >
            {acceptSlashPolicy ? (
              <CheckboxSelected></CheckboxSelected>
            ) : (
              <Checkbox></Checkbox>
            )}
          </span>
          <label className="text-farmText text-sm">
            <FormattedMessage id="accept_pay_slash_tip"></FormattedMessage>
          </label>
          <SlashTip isHiddenText={true}></SlashTip>
        </div>
      ) : null}
    </CommonModal>
  );
}
function CommonModal(props: any) {
  const { isOpen, onRequestClose, title } = props;
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={{
        overlay: {
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
        },
        content: {
          outline: 'none',
          transform: 'translate(-50%, -50%)',
        },
      }}
    >
      <div
        className="px-5 py-6 w-30vw rounded-2xl bg-cardBg"
        style={{ border: '1px solid rgba(0, 198, 162, 0.5)' }}
      >
        <div className="title flex items-center justify-between">
          <label className="text-white text-xl">
            <FormattedMessage id={title}></FormattedMessage>
          </label>
          <ModalClose className="cursor-pointer" onClick={onRequestClose} />
        </div>
        {props.children}
      </div>
    </Modal>
  );
}
function CommonLine(props: any) {
  const { title, ...rest } = props;
  return (
    <div {...rest} className={`flex justify-between mt-4 items-center `}>
      <label className="text-farmText text-sm whitespace-nowrap">
        <FormattedMessage id={title}></FormattedMessage>
      </label>
      {props.children}
    </div>
  );
}
function StakeInputField(props: any) {
  const { balance, changeAmount, amount } = props;
  return (
    <div className="inputArea bg-black bg-opacity-20 rounded-lg px-5 pt-5 pb-3 mt-7">
      <div className="flex justify-between items-center text-sm text-farmText">
        <span>
          <FormattedMessage id="stake"></FormattedMessage>
        </span>
        <span>
          <FormattedMessage id="balance"></FormattedMessage>:
          {toPrecision(balance, 6)}
        </span>
      </div>
      <div className="flex justify-between items-center mt-4">
        <input
          type="number"
          placeholder="0.0"
          value={amount}
          onChange={({ target }) => changeAmount(target.value)}
          className="text-white text-lg w-2/3 focus:outline-non appearance-none leading-tight"
        ></input>
        <div className="flex items-center">
          <span
            onClick={() => {
              changeAmount(balance);
            }}
            className="text-xs text-farmText px-2 py-1 rounded-lg border border-maxBorderColor cursor-pointer"
          >
            Max
          </span>
          <label className="font-bold text-base text-white ml-2.5">
            <FormattedMessage id="lp_Token"></FormattedMessage>
          </label>
        </div>
      </div>
    </div>
  );
}
function UnstakeInput(props: any) {
  const { balance, changeAmount, amount, disabled } = props;
  return (
    <div
      className={`flex flex-grow justify-between items-center rounded-lg overflow-hidden bg-black bg-opacity-20 px-3.5 py-2.5 mr-2 ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <input
        type="number"
        placeholder="0.0"
        value={amount}
        disabled={disabled}
        onChange={({ target }) => changeAmount(target.value)}
        className="text-white text-lg w-3/4 focus:outline-non appearance-none leading-tight"
      ></input>
      <span
        onClick={() => {
          !disabled && changeAmount(balance);
        }}
        className={`text-xs text-farmText px-2 py-1 rounded-lg bg-maxBorderColor ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        Max
      </span>
    </div>
  );
}
function UnStakeInputField(props: any) {
  const [unStakeAmount, setUnStakeAmount] = useState<string | number>('');
  const [buttonStatus, setButtonStatus] = useState('');
  const [unStakeModalVisible, setUnStakeModalVisible] = useState(false);
  const { account, detailData, serverTime, unclaimedRewardData, seedUserInfo } =
    props;
  const seedId = detailData[0]['seed_id'];
  const pool = detailData[0]['pool'];
  const farm = detailData[0];
  const getCurShare = () => {
    const { seed_amount } = account;
    const DECIMALS =
      STABLE_POOL_ID == pool.id ? LP_STABLE_TOKEN_DECIMALS : LP_TOKEN_DECIMALS;
    const v = toReadableNumber(DECIMALS, seed_amount);
    return v;
  };
  function changeUnstakeAmount(anount: string | number) {
    setUnStakeAmount(anount);
  }
  useEffect(() => {
    const { isFree, end_sec } = account;
    if (isFree) {
      setButtonStatus('free');
      return;
    }
    if (serverTime && new BigNumber(serverTime).isGreaterThan(end_sec * 1000)) {
      setButtonStatus('free');
    } else {
      setButtonStatus('locked');
    }
  }, [serverTime]);
  const doUnLocked = () => {
    setButtonStatus('unLocked');
  };
  const openUnstakeModal = () => {
    setUnStakeModalVisible(true);
  };
  const closeUnstakeModal = () => {
    setUnStakeModalVisible(false);
  };
  const balance = getCurShare();
  const isDisabled =
    !unStakeAmount ||
    new BigNumber(unStakeAmount).isLessThanOrEqualTo(0) ||
    new BigNumber(unStakeAmount).isGreaterThan(balance);
  return (
    <div className="flex items-center mt-4">
      <UnstakeInput
        balance={balance}
        disabled={buttonStatus == 'locked'}
        changeAmount={changeUnstakeAmount}
        amount={unStakeAmount}
      ></UnstakeInput>
      <div>
        {buttonStatus == 'free' ? (
          <GradientButton
            disabled={isDisabled}
            btnClassName={`${isDisabled ? 'cursor-not-allowed' : ''}`}
            color="#fff"
            onClick={openUnstakeModal}
            className={`w-28 h-10 text-center text-base text-white focus:outline-none font-semibold ${
              isDisabled ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <FormattedMessage id="unstake" defaultMessage="Unstake" />
          </GradientButton>
        ) : null}
        {buttonStatus == 'locked' ? (
          <OprationButton
            onClick={doUnLocked}
            color="#fff"
            className={`flex items-center justify-center w-28 h-10 text-center text-base text-white focus:outline-none font-semibold bg-lockedBg`}
          >
            <LockedIcon></LockedIcon>
          </OprationButton>
        ) : null}
        {buttonStatus == 'unLocked' ? (
          <OprationButton
            disabled={isDisabled}
            onClick={openUnstakeModal}
            btnClassName={`${isDisabled ? 'cursor-not-allowed' : ''}`}
            color="#fff"
            className={`flex items-center justify-center w-28 h-10 text-center text-base text-white focus:outline-none font-semibold bg-unLockedbg ${
              isDisabled ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <UnLockedIcon className="mr-2"></UnLockedIcon>
            <FormattedMessage id="unstake"></FormattedMessage>
          </OprationButton>
        ) : null}
      </div>
      {unStakeModalVisible ? (
        <UnStakeModal
          title="unstake"
          isOpen={unStakeModalVisible}
          onRequestClose={closeUnstakeModal}
          detailData={detailData}
          account={account}
          amount={unStakeAmount}
          unclaimedRewardData={unclaimedRewardData}
          seedUserInfo={seedUserInfo}
        ></UnStakeModal>
      ) : null}
    </div>
  );
}
