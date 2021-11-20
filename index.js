const https = require("https");

async function translate(text, opts = { from: "ja", to: "en" }) {
	opts.from = opts.from || "auto";
	opts.to = opts.to || "en";

	return getGoogleData()
		.then((res) => {
			const data = {
				rpcids: "MkEWBc",
				"f.sid": extract("FdrFJe", res),
				bl: extract("cfb2h", res),
				hl: "en-US",
				"soc-app": 1,
				"soc-platform": 1,
				"soc-device": 1,
				_reqid: Math.floor(1000 + Math.random() * 9000),
				rt: "c",
			};

			return data;
		})
		.then((data) => {
			return postGoogleData(data, text, opts).then((res) => {
				return extractResult(res);
			});
		});
}

function postGoogleData(data, text, opts) {
	// const url = 'https://translate.google.com';

	const requestDetails = {
		// "protocol": "http:",
		hostname: "translate.google.com",
		port: 443,
		method: "POST",
		path: '/_/TranslateWebserverUi/data/batchexecute?' + (new URLSearchParams(data)).toString(),
		"headers": {
			"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
		}
	};

	const body = 'f.req=' + encodeURIComponent(
		JSON.stringify(
			[
				[
					[
						'MkEWBc',
						JSON.stringify([[text, opts.from, opts.to, true], [null]]),
						null,
						'generic'
					]
				]
			]
		)
	) + '&';

	return new Promise((resolve, reject) => {
		const req = https.request(requestDetails, (res) => {
			res.setEncoding("utf8");
			let jsonString = "";

			res.on("data", (data) => {
				jsonString += data;
			});

			res.on("end", () => {
				res.body = jsonString;
				resolve(res);
			});
		});

		req.on("error", (error) => {
			console.error(error);
			reject(error);
		});
		req.write(body)
		req.end();
	});
}

function getGoogleData() {
	// const url = 'https://translate.google.com';

	const requestDetails = {
		// "protocol": "http:",
		hostname: "translate.google.com",
		port: 443,
		method: "GET",
		// "headers": {
		//   "Content-Type": "application/json"
		// }
	};

	return new Promise((resolve, reject) => {
		const req = https.request(requestDetails, (res) => {
			res.setEncoding("utf8");
			let jsonString = "";

			res.on("data", (data) => {
				jsonString += data;
			});

			res.on("end", () => {
				res.body = jsonString;
				resolve(res);
			});
		});

		req.on("error", (error) => {
			console.error(error);
			reject(error);
		});

		req.end();
	});
}

function extract(key, res) {
	var re = new RegExp(`"${key}":".*?"`);
	var result = re.exec(res.body);
	if (result !== null) {
		return result[0].replace(`"${key}":"`, "").slice(0, -1);
	}
	return "";
}

function extractResult(res) {
	let json = res.body.slice(6);
	let length = "";

	const result = {
		text: "",
		pronunciation: "",
		from: {
			language: {
				didYouMean: false,
				iso: "",
			},
			text: {
				autoCorrected: false,
				value: "",
				didYouMean: false,
			},
		},
		raw: "",
	};

	try {
		length = /^\d+/.exec(json)[0];
		json = JSON.parse(
			json.slice(length.length, parseInt(length, 10) + length.length)
		);
		json = JSON.parse(json[0][2]);
		result.raw = json;
	} catch (e) {
		return result;
	}

	if (json[1][0][0][5] === undefined || json[1][0][0][5] === null) {
		// translation not found, could be a hyperlink or gender-specific translation?
		result.text = json[1][0][0][0];
	} else {
		result.text = json[1][0][0][5]
			.map(function (obj) {
				return obj[0];
			})
			.filter(Boolean)
			// Google api seems to split text per sentences by <dot><space>
			// So we join text back with spaces.
			// See: https://github.com/vitalets/google-translate-api/issues/73
			.join(" ");
	}
	result.pronunciation = json[1][0][0][1];

	// From language
	if (json[0] && json[0][1] && json[0][1][1]) {
		result.from.language.didYouMean = true;
		result.from.language.iso = json[0][1][1][0];
	} else if (json[1][3] === "auto") {
		result.from.language.iso = json[2];
	} else {
		result.from.language.iso = json[1][3];
	}

	// Did you mean & autocorrect
	if (json[0] && json[0][1] && json[0][1][0]) {
		let str = json[0][1][0][0][1];

		str = str.replace(/<b>(<i>)?/g, "[");
		str = str.replace(/(<\/i>)?<\/b>/g, "]");

		result.from.text.value = str;

		if (json[0][1][0][2] === 1) {
			result.from.text.autoCorrected = true;
		} else {
			result.from.text.didYouMean = true;
		}
	}

	return result;
}

module.exports = translate;
