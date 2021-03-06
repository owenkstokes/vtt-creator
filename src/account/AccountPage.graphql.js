import {gql} from '@apollo/client'

export const AccountPage_userFragment = gql`
	fragment AccountPage_user on User {
		id
		email
		credit
		creditMinutes
		unlimitedUsage
	}
`
