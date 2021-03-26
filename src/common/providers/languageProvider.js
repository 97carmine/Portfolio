import { useState } from "react";
import PropTypes from "prop-types";
import { RawIntlProvider, IntlProvider } from "react-intl";
import messages from "../languages/messages";
import { isRunningOnClientSide } from "../utils/checkClientServer";

const LanguageProvider = ({ intl, children }) => {
	const [language] = useState(isRunningOnClientSide && document.documentElement.lang);

	return intl === undefined ? (
		<IntlProvider locale={language} key={language} messages={messages[language]}>
			{children}
		</IntlProvider>
	) : (
		<RawIntlProvider value={intl}>{children}</RawIntlProvider>
	);
};

LanguageProvider.propTypes = {
	intl: PropTypes.object,
	children: PropTypes.array.isRequired,
};

export default LanguageProvider;
