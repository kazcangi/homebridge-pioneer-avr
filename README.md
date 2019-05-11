# homebridge-pioneer-avr [![npm version](https://badge.fury.io/js/homebridge-pioneer-avr.svg)](https://badge.fury.io/js/homebridge-pioneer-avr)

homebridge-pioneer-avr is a plugin made for [homebridge](https://github.com/nfarina/homebridge),
which declare your Pioneer AVR as a TV in homekit (iOS 12.2 nedded).
It should work with Pioneer AVRs supported by the iControl AV5 App. It works well with my VSX-922.

## Features

Declare your AVR as a homekit TV :
* Turn AVR On/Off
* Auto discover inputs
* Select active input in home app
* Select inputs to shown in the input list
* Save visibility status for inputs
* Rename inputs in home apps
* Control volume through the command in control center
* Control AVR with Remote in Control Center on iOS

## Installation

1. Install the homebridge framework using `npm install -g homebridge`
2. Install **homebridge-pioneer-avr** using `npm install -g homebridge-pioneer-avr`
3. Update your configuration file. See `sample-config.json` in this repository for a sample. 

## Accessory configuration example

```json
"accessories": [
	{
        "accessory": "pioneerAvrAccessory",
        "model": "VSX-922",
        "name": "My Pioneer AVR",
        "description": "AV Receiver",
        "ip": "192.168.178.99",
        "port": 23
	}
]
```

*Notice: If port 23 does not work, try port 8102.

## Links

https://github.com/rwifall/pioneer-receiver-notes
https://github.com/merdok/homebridge-webos-tv
https://github.com/TG908/homebridge-vsx

## Release Notes

### v0.6

* First support for remote keys (through Control Center -> Remote on iOS)

### v0.5

* Save CurrentVisibilityState for inputs

### v0.4

* Allow to rename inputs in Home app

### v0.3

* Turn AVR On/Off
* Auto discover inputs
* Select active input in home app
* Select inputs to show in the input list
* Control volume through the command in control center with iPhone +/- buttons

