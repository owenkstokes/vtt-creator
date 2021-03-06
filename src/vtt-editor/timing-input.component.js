import React from 'react'
import * as PropTypes from 'prop-types'
import clsx from 'clsx'
import {InputBase as MuiInputBase, TextField} from '@material-ui/core'
import {makeStyles, withStyles} from '@material-ui/styles'

export default function TimingInput(props) {
	return <TextField {...props} InputProps={{inputComponent: InputWrapper}} InputLabelProps={{shrink: true}} />
}

const useStyles = makeStyles({
	root: {
		padding: '0 14px',
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		display: 'flex',
	},
	separator: {
		padding: '10.5px 0',
	},
	twoChars: {
		width: 19,
	},
	mills: {
		flex: 1,
	},
	input: {
		margin: 0,
		'& input[type=number]::-webkit-inner-spin-button': {
			'-webkit-appearance': 'none',
		},
		'& input[type=number]::-webkit-outer-spin-button': {
			'-webkit-appearance': 'none',
		},
		'& input[type=number]': {
			'-moz-appearance': 'textfield',
		},
	},
})

const InputBase = withStyles({
	input: {
		padding: '10.5px 0',
	},
})(MuiInputBase)

InputWrapper.propTypes = {
	value: PropTypes.number,
	onChange: PropTypes.func.isRequired,
	onBlur: PropTypes.func,
	onFocus: PropTypes.func,
}

function InputWrapper({value, onChange, onBlur, onFocus}) {
	const classes = useStyles()

	const [values, setValues] = React.useState({
		hours: '00',
		mins: '00',
		secs: '00',
		mills: '000',
	})

	const hourRef = React.useRef('00')
	const minRef = React.useRef('00')
	const secRef = React.useRef('00')
	const millRef = React.useRef('000')

	const containerRef = React.useRef()

	const hourInputRef = React.useRef()
	const minInputRef = React.useRef()
	const secInputRef = React.useRef()
	const millInputRef = React.useRef()

	React.useEffect(() => {
		const [hours, mins, secs, mills] = fromSeconds(value)

		hourRef.current = hours
		minRef.current = mins
		secRef.current = secs
		millRef.current = mills

		setValues({
			hours,
			mins,
			secs,
			mills,
		})
	}, [value])

	const handleChangeHours = hours => {
		hourRef.current = hours
		setValues(v => ({...v, hours}))
	}

	const handleChangeMins = mins => {
		minRef.current = mins
		setValues(v => ({...v, mins}))
	}

	const handleChangeSecs = secs => {
		secRef.current = secs
		setValues(v => ({...v, secs}))
	}

	const handleChangeMills = mills => {
		millRef.current = mills
		setValues(v => ({...v, mills}))
	}

	const focusHours = () => {
		hourInputRef.current.focus()
	}

	const focusMins = () => {
		minInputRef.current.focus()
	}

	const focusSecs = () => {
		secInputRef.current.focus()
	}

	const focusMills = () => {
		millInputRef.current.focus()
	}

	function handleFocusRoot(e) {
		// only fire root focus if we just came from outside the control
		if (!containerRef.current.contains(e.relatedTarget)) {
			onFocus(e)
		}
	}

	function handleBlurRoot(e) {
		// only fire root blur if we went somewhere outside of the root element of the control
		if (!containerRef.current.contains(e.relatedTarget)) {
			onChange(toSeconds(hourRef.current, minRef.current, secRef.current, millRef.current))
			onBlur(e)
		}
	}

	return (
		<div ref={containerRef} className={classes.root} onFocus={handleFocusRoot} onBlur={handleBlurRoot}>
			<MemInput
				ref={hourInputRef}
				maxLength={2}
				value={values.hours}
				onChange={handleChangeHours}
				onNext={focusMins}
				className={clsx(classes.input, classes.twoChars)}
			/>
			<span className={classes.separator}>:</span>
			<MemInput
				ref={minInputRef}
				maxLength={2}
				value={values.mins}
				onChange={handleChangeMins}
				onPrev={focusHours}
				onNext={focusSecs}
				className={clsx(classes.input, classes.twoChars)}
			/>
			<span className={classes.separator}>:</span>
			<MemInput
				ref={secInputRef}
				maxLength={2}
				value={values.secs}
				onChange={handleChangeSecs}
				onPrev={focusMins}
				onNext={focusMills}
				className={clsx(classes.input, classes.twoChars)}
			/>
			<span className={classes.separator}>.</span>
			<MemInput
				ref={millInputRef}
				inputProps={{maxLength: 3}}
				maxLength={3}
				value={values.mills}
				onChange={handleChangeMills}
				onPrev={focusSecs}
				className={clsx(classes.input, classes.mills)}
			/>
		</div>
	)
}

const MemInput = React.forwardRef(function MemInput(
	{value, maxLength, onChange, onBlur, onFocus, onNext, onPrev, inputProps, ...props},
	ref
) {
	const [_value, _setValue] = React.useState(value)

	const _valueRef = React.useRef(_value)

	React.useEffect(() => {
		_valueRef.current = value
		_setValue(value)
	}, [value])

	const handleFocus = e => {
		_valueRef.current = ''
		_setValue('')
		onFocus?.(e)
	}

	const handleChange = e => {
		const v = e.target.value
		_valueRef.current = v
		_setValue(v)
		if (v.length === maxLength) onNext?.()
		if (!v.length) onPrev?.()
	}

	const handleBlur = e => {
		const existingNum = Number(value)
		const pendingNum = Number(_valueRef.current)
		const validInput = Boolean(_valueRef.current && Number.isFinite(pendingNum))
		const numericallyEqual = existingNum === pendingNum

		if (!numericallyEqual && validInput) {
			const newVal = pendingNum.toString().padStart(maxLength, '0')
			_setValue(newVal)
			onChange(newVal)
		} else {
			const newVal = existingNum.toString().padStart(maxLength, '0')
			_setValue(newVal)
			onChange(newVal)
		}

		onBlur?.(e)
	}

	const handleKeyDown = e => {
		if (e.key === 'Enter') {
			e.target.blur()
		}
	}

	return (
		<InputBase
			{...props}
			type="number"
			inputProps={{...inputProps, pattern: '[0-9]*', inputMode: 'numeric', ref}}
			value={_value}
			placeholder={value}
			onChange={handleChange}
			onFocus={handleFocus}
			onBlur={handleBlur}
			onKeyDown={handleKeyDown}
		/>
	)
})

function toSeconds(hours, mins, secs, mills) {
	return Number(hours) * 3600 + Number(mins) * 60 + Number(secs) + Number(mills) / 1000
}

function fromSeconds(value) {
	const hours = Math.floor(value / 3600)
		.toString()
		.padStart(2, '0')

	const mins = Math.floor((value - hours * 3600) / 60)
		.toString()
		.padStart(2, '0')

	const secs = Math.floor(value % 60)
		.toString()
		.padStart(2, '0')

	const mills = Math.round((value - Math.floor(value)) * 1000)
		.toString()
		.padStart(3, '0')

	return [hours, mins, secs, mills]
}
