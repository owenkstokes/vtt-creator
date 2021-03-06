import React from 'react'
import ReactDOM from 'react-dom'
import {ApolloProvider} from '@apollo/client'
import apolloClient from './ApolloClient'
import {ThemeProvider as MuiThemeProvider} from '@material-ui/core/styles'
import CssBaseline from '@material-ui/core/CssBaseline'
import * as Sentry from '@sentry/browser'
import theme from './mui-theme'
import Router from './AppRouter'
import {ToastProvider, ErrorBoundary} from './common'
import {SentryDSN} from './config'
import {UploadProvider} from './BatchTranscriptionCheckout/UploadProvider'

function AppWrapper() {
	return (
		<MuiThemeProvider theme={theme}>
			<CssBaseline />
			<ErrorBoundary>
				<ApolloProvider client={apolloClient}>
					<ToastProvider>
						<UploadProvider>
							<Router />
						</UploadProvider>
					</ToastProvider>
				</ApolloProvider>
			</ErrorBoundary>
		</MuiThemeProvider>
	)
}

Sentry.init({dsn: SentryDSN})

const root = document.getElementById('react-root')
if (!root) throw new Error('Could not find react dom root')
ReactDOM.render(<AppWrapper />, root)
