import {
  ChainId,
  Fetcher,
  Percent,
  Route,
  Token,
  TokenAmount,
  Trade,
  TradeType,
  WETH,
} from "@pancakeswap/sdk";
import { JsonRpcProvider } from "@ethersproject/providers";
import { useEffect, useState } from "react";
import Web3 from "web3";
import { provider } from "web3-core";
import PropTypes from "prop-types";
import {
  ArrowNarrowDownIcon,
  SwitchHorizontalIcon,
} from "@heroicons/react/solid";
import { AbiItem } from "web3-utils";
import bnbIcon from "../src/images/bnb.svg";
import unknownCoin from "../src/images/unknown-coin.svg";

declare global {
  interface Window {
    ethereum: any;
  }
}

interface PancakeApiResponse {
  updated_at: number;
  data: {
    name: string;
    symbol: string;
    price: string;
    price_BNB: string;
  };
}

//#region Props
interface Props {
  web3?: Web3;
  web3Provider?: provider;
  pancakeRouterAddress?: string;

  walletAddress: string;
  onTransactionComplete: Function;
  onTransactionError: Function;

  // Chain
  chainId?: ChainId;
  chainRpcUrl?: string;

  // Coin
  coinAddress: string;
  coinABI: AbiItem;
  coinDecimals: number;
  coinLogo?: any;
  coinSymbol: string;
}

Widget.PropTypes = {
  web3: PropTypes.object,
  web3Provider: PropTypes.object,
  pancakeRouterAddress: PropTypes.string,

  walletAddress: PropTypes.string.isRequired,
  onTransactionComplete: PropTypes.func.isRequired,
  onTransactionError: PropTypes.func.isRequired,

  // Chain
  chainID: PropTypes.oneOf(Object.values(ChainId) as ChainId[]),
  ChainRpcUrl: PropTypes.string,

  // Coin
  coinAddress: PropTypes.string.isRequired,
  coinABI: PropTypes.object.isRequired,
  coinDecimals: PropTypes.number.isRequired,
  coinLogo: PropTypes.any,
  coinSymbol: PropTypes.string.isRequired,
};

//#endregion

function Widget({
  web3,
  web3Provider,
  coinAddress,
  coinABI,
  walletAddress,
  onTransactionComplete,
  onTransactionError,
  chainId = 56,
  chainRpcUrl = "https://bsc-dataseed.binance.org/",
  coinDecimals,
  pancakeRouterAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  coinLogo = unknownCoin,
  coinSymbol,
}: Props) {
  const [bnbQuantity, setBnbQuantity] = useState(0);
  const [coinQuantity, setCoinQuantity] = useState(0);
  const [localWeb3, setLocalWeb3] = useState<Web3>();
  const [coinPrice, setCoinPrice] = useState("0");

  // Initialize web3
  useEffect(() => {
    // If web3 gets passed as a prop use that
    if (web3) {
      setLocalWeb3(web3);
      return;
    }

    // Otherwise initialize it with the passed provider
    setLocalWeb3(new Web3(web3Provider as provider));
  }, []);

  // Get coin price
  useEffect(() => {
    fetch(`https://api.pancakeswap.info/api/v2/tokens/${coinAddress}`)
      .then((response) => response.json())
      .then((data: PancakeApiResponse) => setCoinPrice(data.data.price_BNB));

    // TODO: Add an option to update the price periodically
  }, []);

  const swap = async () => {
    if (!localWeb3) throw "Web3 did not initialize correctly";
    const coin = new Token(
      chainId,
      localWeb3.utils.toChecksumAddress(coinAddress),
      coinDecimals
    );

    const provider = new JsonRpcProvider(chainRpcUrl);
    const pair = await Fetcher.fetchPairData(
      coin,
      WETH[coin.chainId],
      provider
    );
    const route = new Route([pair], WETH[coin.chainId]);
    const trade = new Trade(
      route,
      new TokenAmount(
        WETH[coin.chainId],
        localWeb3.utils.toWei(bnbQuantity.toString())
      ),
      TradeType.EXACT_INPUT
    );

    // Slippage 14%
    const slippageTolerance = new Percent("1400", "10000");
    const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
    const path = [WETH[coin.chainId].address, coin.address];
    const to = walletAddress;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const value = trade.inputAmount.raw;
    const routerContract = new localWeb3.eth.Contract(coinABI, coinAddress, {
      from: walletAddress,
    });
    const data = routerContract.methods.swapExactETHForTokens(
      localWeb3.utils.toHex(amountOutMin.toString()),
      path,
      to,
      localWeb3.utils.toHex(deadline)
    );
    const nonce = await localWeb3.eth.getTransactionCount(walletAddress);
    const rawTransaction = {
      from: walletAddress,
      gasPrice: localWeb3.utils.toHex(2100000000),
      gasLimit: localWeb3.utils.toHex(210000),
      to: pancakeRouterAddress,
      value: localWeb3.utils.toHex(value.toString()),
      data: data.encodeABI(),
      nonce: localWeb3.utils.toHex(nonce),
    };

    window.ethereum
      .request({
        method: "eth_sendTransaction",
        params: [rawTransaction],
      })
      .then((result: any) => onTransactionComplete(result))
      .catch((error: any) => onTransactionError(error));
  };

  const updateBnb = (value: number) => {
    setBnbQuantity(value);
    setCoinQuantity(value / Number(coinPrice));
  };

  const updateBitc = (value: number) => {
    setCoinQuantity(value);
    setBnbQuantity(value * Number(coinPrice));
  };

  const setMaxAmount = () => {
    if (!localWeb3) throw "Web3 did not initialize correctly";
    localWeb3.eth.getBalance(walletAddress).then((balance: string) => {
      const maxBalance = localWeb3.utils.fromWei(balance);
      updateBnb(Number(maxBalance));
    });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-8 max-w-9xl mx-auto bg-white border shadow-md rounded-md w-4/5 sm:w-3/5 sm:max-w-lg hidden">
      <section>
        <div className="sm:flex sm:justify-center flex-col">
          <div className="mb-2 flex justify-center">
            <h3 className="text-xl font-bold">Buy BITC</h3>
          </div>
          <div className="mb-2">
            <label
              className="leading-5 py-2 px-3 block text-xs text-gray-800 bg-purple-50 font-medium rounded-t-md border border-gray-300 border-b-0 shadow-sm"
              htmlFor="name"
            >
              Quantity (BNB)
            </label>
            <div className="relative">
              <input
                onChange={(e) => updateBnb(Number(e.target.value))}
                value={bnbQuantity}
                id="bnb"
                className="leading-5 py-2 px-3 text-sm text-gray-800 bg-purple-50 placeholder-gray-400 font-medium rounded-t-none rounded-b-md border border-gray-300 border-t-0 shadow-sm w-full h-12"
                type="number"
                placeholder="0.0"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-5">
                <button
                  className="mx-4 text-yellow-400 font-medium"
                  onClick={() => setMaxAmount()}
                >
                  MAX
                </button>
                <img src={bnbIcon} alt="bnb logo" className="h-7" />
              </div>
            </div>
          </div>
          <div className="mb-2 flex justify-center">
            <ArrowNarrowDownIcon />
          </div>
          <div className="mb-6">
            <label
              className="leading-5 py-2 px-3 block text-xs text-gray-800 bg-purple-50 font-medium rounded-t-md border border-gray-300 border-b-0 shadow-sm"
              htmlFor="business-id"
            >
              To ({coinSymbol})
            </label>
            <div className="relative">
              <input
                onChange={(e) => updateBitc(Number(e.target.value))}
                value={coinQuantity}
                id="bitc"
                className="leading-5 py-2 px-3 text-sm text-gray-800 bg-purple-50 placeholder-gray-400 font-medium rounded-t-none rounded-b-md border border-gray-300 border-t-0 shadow-sm w-full h-12"
                type="number"
                placeholder="0.0"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-5">
                <img src={coinLogo} alt="bitc logo" className="h-7" />
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => swap()}
          className="btn bg-purple-500 hover:bg-purple-600 text-white my-4 w-full"
        >
          <span className="text-white mr-2">Buy</span>
          <SwitchHorizontalIcon />
        </button>
      </section>
    </div>
  );
}

export default Widget;
