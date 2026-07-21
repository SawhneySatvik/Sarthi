import NetInfo from "@react-native-community/netinfo";

import type { ConnectivitySource } from "./connectivity";

/** Expo/React Native adapter; Internet reachability must not be explicitly false. */
export const expoConnectivity: ConnectivitySource = {
  subscribe(listener) {
    return NetInfo.addEventListener((state) => listener(state.isConnected === true && state.isInternetReachable !== false));
  },
};
