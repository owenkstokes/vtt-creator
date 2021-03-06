import chai from 'chai'
import {getSRTFromCues, getCuesFromSRT, MalformedSRTTimestampError} from './srt.service'

const SRTFile = `1
00:00:00,000 --> 00:00:02,900
The ABC Company code of conduct is an

2
00:00:02,900 --> 00:00:05,000
important tool for anyone who works on

3
00:00:05,000 --> 00:00:09,500
ABC's behalf. So, how do you use it first

4
00:00:09,500 --> 00:00:09,500


5
00:00:09,500 --> 00:00:11,400
read through the whole document to make

6
00:00:11,400 --> 00:00:12,500
sure you understand it?`

// has extra newlines, spaces, and tabs
const SRTFileWExtraNewlinesAndSpaces = `1
00:00:00,000-->  00:00:02,900
The ABC Company code of conduct is an


2
00:00:02,900  -->  00:00:05,000
important tool for anyone who works on

3 
00:00:05,000 -->00:00:09,500
ABC's behalf. So, how do you use it first


4	
00:00:09,500 -->00:00:09,500
 	

 
5
00:00:09,500-->00:00:11,400
read through the whole document to make
	
6
00:00:11,400 -->	00:00:12,500
sure you understand it?
	 `

const SRTFileBadTimestamp1 = `1
00:00:00,000 --> 00:00:03700
The ABC Company code of conduct is an important tool

2
00:00:03,700 --> 00:00:07,800
for anyone who works on ABC's behalf. So, how do

3
00:00:07,800 --> 00:00:10,900
you use it first read through the whole document

4
00:00:10,900 --> 00:00:12,500
to make sure you understand it?`

const SRTFileBadTimestamp2 = `1
00:00:00,000 --> 00:0003,700
The ABC Company code of conduct is an important tool

2
00:00:03,700 --> 00:00:07,800
for anyone who works on ABC's behalf. So, how do

3
00:00:07,800 --> 00:00:10,900
you use it first read through the whole document

4
00:00:10,900 --> 00:00:12,500
to make sure you understand it?`

const SRTFileBadTimestamp3 = `1
00:00:00,000 --> 
The ABC Company code of conduct is an important tool

2
00:00:03,700 --> 00:00:07,800
for anyone who works on ABC's behalf. So, how do

3
00:00:07,800 --> 00:00:10,900
you use it first read through the whole document

4
00:00:10,900 --> 00:00:12,500
to make sure you understand it?`

const cues = [
	new VTTCue(0, 2.9, 'The ABC Company code of conduct is an'),
	new VTTCue(2.9, 5, 'important tool for anyone who works on'),
	new VTTCue(5, 9.5, "ABC's behalf. So, how do you use it first"),
	new VTTCue(9.5, 9.5, ''),
	new VTTCue(9.5, 11.4, 'read through the whole document to make'),
	new VTTCue(11.4, 12.5, 'sure you understand it?'),
]

describe('srt.service', function() {
	describe('getSRTFromCues', function() {
		it('should output the correct srt file string', async () => {
			const srtBlob = getSRTFromCues(cues)
			const result = await readTextFile(srtBlob)
			chai.assert.strictEqual(result.trim(), SRTFile)
		})
	})

	describe('getCuesFromSRT', function() {
		it('should output the correct cues', async () => {
			const srtBlob = new Blob([SRTFile], {type: 'text/srt'})
			const actualCues = await getCuesFromSRT(srtBlob)
			chai.expect(actualCues).to.have.length(6)

			actualCues.forEach((cue, i) => {
				chai.expect(cue.startTime).to.equal(cues[i].startTime)
				chai.expect(cue.endTime).to.equal(cues[i].endTime)
				chai.expect(cue.text).to.equal(cues[i].text)
			})
		})

		it('should output the correct cues even with weird spacing and extra newlines', async () => {
			const srtBlob = new Blob([SRTFileWExtraNewlinesAndSpaces], {type: 'text/srt'})
			const actualCues = await getCuesFromSRT(srtBlob)
			chai.expect(actualCues).to.have.length(6)

			actualCues.forEach((cue, i) => {
				chai.expect(cue.startTime).to.equal(cues[i].startTime)
				chai.expect(cue.endTime).to.equal(cues[i].endTime)
				chai.expect(cue.text).to.equal(cues[i].text)
			})
		})

		it('should throw a bad timestamp error when a timestamp is missing a comma', done => {
			const srtBlob = new Blob([SRTFileBadTimestamp1], {type: 'text/srt'})
			getCuesFromSRT(srtBlob)
				.then(() => {
					done(new Error('expected an error, but the srt file parsed successfully'))
				})
				.catch(err => {
					chai.expect(err).to.be.an.instanceof(MalformedSRTTimestampError)
					done()
				})
		})

		it('should throw a bad timestamp error when a timestamp is missing a colon', done => {
			const srtBlob = new Blob([SRTFileBadTimestamp2], {type: 'text/srt'})
			getCuesFromSRT(srtBlob)
				.then(() => {
					done(new Error('expected an error, but the srt file parsed successfully'))
				})
				.catch(err => {
					chai.expect(err).to.be.an.instanceof(MalformedSRTTimestampError)
					done()
				})
		})

		it('should throw a bad timestamp error when a timestamp is straight up missing', done => {
			const srtBlob = new Blob([SRTFileBadTimestamp3], {type: 'text/srt'})
			getCuesFromSRT(srtBlob)
				.then(() => {
					done(new Error('expected an error, but the srt file parsed successfully'))
				})
				.catch(err => {
					chai.expect(err).to.be.an.instanceof(MalformedSRTTimestampError)
					done()
				})
		})
	})
})

function readTextFile(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.addEventListener('error', () => {
			reader.abort()
			reject(new Error('An error occurred while reading the file.'))
		})
		reader.addEventListener('load', () => {
			resolve(reader.result)
		})
		reader.readAsText(file)
	})
}
