/** `react-router-dom` `location.state` shapes — not cross-FE/BE contracts, so kept out of `packages/shared`. */
export interface ForgotPasswordLocationState {
  email: string;
}

export interface VerifyOtpLocationState {
  resetToken: string;
}
