import React, { useEffect, useRef, useState, useContext } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import FarmsHome from '~components/farm/FarmsHome';
import FarmsDetail from '~components/farm/FarmsDetail';
import { useHistory, useLocation } from 'react-router-dom';
export default function FarmsPageV2(props: any) {
  const [detailData, setDetailData] = useState(null);
  const [tokenPriceList, setTokenPriceList] = useState(null);
  const getDetailData = (detailData: any, tokenPriceList: any) => {
    setDetailData(detailData);
    setTokenPriceList(tokenPriceList);
  };
  const emptyDetailData = () => {
    setDetailData(null);
  };
  function getUrlParams() {
    const pathArr = location.pathname.split('/');
    const seedId = pathArr[2] || '';
    return seedId;
  }
  return (
    <>
      <FarmsHome getDetailData={getDetailData}></FarmsHome>
      {getUrlParams() &&
      detailData &&
      Object.keys(tokenPriceList || []).length > 0 ? (
        <FarmsDetail
          detailData={detailData}
          tokenPriceList={tokenPriceList}
          emptyDetailData={emptyDetailData}
        ></FarmsDetail>
      ) : null}
    </>
  );
}
