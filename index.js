/*
    Pioneer AVR TV Accessory Module for homebridge
*/
const PioneerAvr = require('./pioneer-avr');
const ppath = require('persist-path');
const fs = require('fs');
const mkdirp = require('mkdirp');

let Service;
let Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-pioneer-avr", "pioneerAvrAccessory", pioneerAvrAccessory);
};

function pioneerAvrAccessory(log, config) {
    // Main accessory initialization
    this.log = log;
    this.name = config.name;
    this.host = config.host;
    this.port = config.port;
    this.model = config.model || "VSX-922";
    this.prefsDir = config.prefsDir || ppath('pioneerAvr/');

    log.info(this.prefsDir);
    this.manufacturer = "Pioneer";
    this.version = "0.6";

    // check if prefs directory ends with a /, if not then add it
    if (this.prefsDir.endsWith('/') === false) {
        this.prefsDir = this.prefsDir + '/';
    }

    // check if the preferences directory exists, if not then create it
    if (fs.existsSync(this.prefsDir) === false) {
        mkdirp(this.prefsDir);
    }

    this.inputVisibilityFile = this.prefsDir + 'inputsVisibility_' + this.host;
    this.savedVisibility = {};
    try {
        this.savedVisibility = JSON.parse(fs.readFileSync(this.inputVisibilityFile));
    } catch (err) {
        this.log.debug('Input visibility file does not exist');
    }

    this.avr = new PioneerAvr(this.log, this.host, this.port);
    this.enabledServices = [];

    this.prepareInformationService();
    this.prepareTvService();
    this.prepareTvSpeakerService();
    this.prepareInputSourceService();
}

pioneerAvrAccessory.prototype.prepareInformationService = function() {
    // Set accessory informations
    this.informationService = new Service.AccessoryInformation();
    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
        .setCharacteristic(Characteristic.Model, this.model)
        .setCharacteristic(Characteristic.SerialNumber, this.host)
        .setCharacteristic(Characteristic.FirmwareRevision, this.version);

    this.enabledServices.push(this.informationService);
};

pioneerAvrAccessory.prototype.prepareTvService = function () {
    // Create TV service for homekit
    const me = this;

    this.tvService = new Service.Television(this.name, 'tvService');
    this.tvService
        .setCharacteristic(Characteristic.ConfiguredName, this.name);
    this.tvService
        .setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

    // Set Active charateristic to power on or off AVR
    this.tvService
        .getCharacteristic(Characteristic.Active)
        .on('get', this.getPowerOn.bind(this))
        .on('set', this.setPowerOn.bind(this));

    // ActiveIdentifier show and set current input on TV badge in homekit
    this.tvService
        .getCharacteristic(Characteristic.ActiveIdentifier)
        .on('get', this.getActiveIdentifier.bind(this))
        .on('set', this.setActiveIdentifier.bind(this));

    // Remote Key
    this.tvService
        .getCharacteristic(Characteristic.RemoteKey)
        .on('set', this.remoteKeyPress.bind(this));

    this.enabledServices.push(this.tvService);
};

pioneerAvrAccessory.prototype.prepareTvSpeakerService = function () {
    // Create Service.TelevisionSpeaker and  associate to tvService
    this.tvSpeakerService = new Service.TelevisionSpeaker(this.name + ' Volume', 'tvSpeakerService');
    this.tvSpeakerService
        .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
        .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);
    this.tvSpeakerService
        .getCharacteristic(Characteristic.VolumeSelector)
        .on('set', (state, callback) => {
            this.log.debug('Volume change over the remote control (VolumeSelector), pressed: %s', state === 1 ? 'Down' : 'Up');
            this.setVolumeSwitch(state, callback, !state);
        });
    this.tvSpeakerService
        .getCharacteristic(Characteristic.Mute)
        .on('get', this.getMuted.bind(this))
        .on('set', this.setMuted.bind(this));
    this.tvSpeakerService
        .addCharacteristic(Characteristic.Volume)
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));

    this.tvService.addLinkedService(this.tvSpeakerService);
    this.enabledServices.push(this.tvSpeakerService);
};

pioneerAvrAccessory.prototype.prepareInputSourceService = function () {
    // Run avr.loadInputs with addInputSourceService callback to create each input service
    this.log.info('Discovering inputs');
    this.avr.loadInputs(this.addInputSourceService.bind(this));
};

pioneerAvrAccessory.prototype.addInputSourceService = function(key) {
    // Create an inout service from the informations in avr.inputs
    const me = this;

    this.log.info('Add input n°%s - Name: %s Id: %s Type: %s',
        key, this.avr.inputs[key].name,
        this.avr.inputs[key].id,
        this.avr.inputs[key].type
        );

    let savedInputVisibility;
    if (this.avr.inputs[key].id in this.savedVisibility) {
        savedInputVisibility = this.savedVisibility[this.avr.inputs[key].id];
    } else {
        savedInputVisibility = Characteristic.CurrentVisibilityState.SHOWN;
    }
    let tmpInput = new Service.InputSource(this.avr.inputs[key].name, 'tvInputService' + key);
    tmpInput
        .setCharacteristic(Characteristic.Identifier, key)
        .setCharacteristic(Characteristic.ConfiguredName, this.avr.inputs[key].name) // Name in home app
        .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(Characteristic.InputSourceType, this.avr.inputs[key].type)
        .setCharacteristic(Characteristic.CurrentVisibilityState, savedInputVisibility) // Show in input list
        .setCharacteristic(Characteristic.TargetVisibilityState, savedInputVisibility); // Enable show selection
    tmpInput
        .getCharacteristic(Characteristic.TargetVisibilityState)
        .on('set', (state, callback) => {
            me.log.debug('Set %s TargetVisibilityState %s', me.avr.inputs[key].name, state);
            me.savedVisibility[me.avr.inputs[key].id] = state;
            fs.writeFile(me.inputVisibilityFile, JSON.stringify(me.savedVisibility), (err) => {
                if (err) {
                    me.log.debug('Error : Could not write input visibility %s', err);
                } else {
                    me.log.debug('Input visibility successfully saved');
                }
            });
            tmpInput.setCharacteristic(Characteristic.CurrentVisibilityState, state);
            callback();
        });
    tmpInput
        .getCharacteristic(Characteristic.ConfiguredName)
        .on('set', (name, callback) => { // Rename inout
            me.log.info('Rename input %s to %s', me.avr.inputs[key].name, name);
            me.avr.inputs[key].name = name.substring(0,14);
            me.avr.renameInput(me.avr.inputs[key].id, name);
            callback();
        });

    this.tvService.addLinkedService(tmpInput);
    this.enabledServices.push(tmpInput);
};

// Callback methods
// Callbacks for InformationService
pioneerAvrAccessory.prototype.getPowerOn = function (callback) {
    // Get AVR's power status
    this.log.info('Get power status');
    this.avr.powerStatus(callback);
};

pioneerAvrAccessory.prototype.setPowerOn = function (on, callback) {
    // Set power on/off
    if (on) {
        this.log.info('Power on');
        this.avr.powerOn();
    } else {
        this.log.info('Power off');
        this.avr.powerOff();
    }

    callback();
};

pioneerAvrAccessory.prototype.getActiveIdentifier = function (callback) {
    // Update current unput
    this.log.info('Get input status');
    this.avr.inputStatus(callback);
};

pioneerAvrAccessory.prototype.setActiveIdentifier = function(newValue, callback) {
    // Change input
    this.log.info('set active identifier %s:%s ', newValue, this.avr.inputs[newValue].id);
    this.avr.setInput(this.avr.inputs[newValue].id);

    callback();
};

// Callbacks for TelevisionSpeaker service
pioneerAvrAccessory.prototype.setVolumeSwitch = function(state, callback, isUp) {
    // Manage volume buttons in remote control center
    if (isUp) {
        this.log.info('Volume up');
        this.avr.volumeUp();
    } else {
        this.log.info('Volume down');
        this.avr.volumeDown();
    }

    callback();
};

pioneerAvrAccessory.prototype.getMuted = function (callback) {
    // Get mute status
    this.log.info('Get mute status');
    this.avr.muteStatus(callback);
};

pioneerAvrAccessory.prototype.setMuted = function (mute, callback) {
    // Set mute on/off
    if (mute) {
        this.log.info('Mute on');
        this.avr.muteOn();
    } else {
        this.log.info('Mute off');
        this.avr.muteOff();
    }

    callback();
};

pioneerAvrAccessory.prototype.getVolume = function (callback) {
    // Get volume status
    this.log.info('Get volume status');
    this.volumeStatus(callback);
};

pioneerAvrAccessory.prototype.setVolume = function (volume, callback) {
    // Set volume status
    this.log.info('Set volume to %s', volume);
    this.avr.setVolume(volume, callback);
};

// Callback for Remote key
pioneerAvrAccessory.prototype.remoteKeyPress = function(remoteKey, callback) {
    this.log.info('Remote key pressed : %s', remoteKey);
    switch (remoteKey) {
        case Characteristic.RemoteKey.REWIND:
            this.log.info('Rewind remote key not implemented');
            break;
        case Characteristic.RemoteKey.FAST_FORWARD:
            this.log.info('Fast forward remote key not implemented');
            break;
        case Characteristic.RemoteKey.NEXT_TRACK:
            this.log.info('Next track remote key not implemented');
            callback();
            break;
        case Characteristic.RemoteKey.PREVIOUS_TRACK:
            this.log.info('Previous track remote key not implemented');
            callback();
            break;
        case Characteristic.RemoteKey.ARROW_UP:
            this.avr.remoteKey('UP');
            break;
        case Characteristic.RemoteKey.ARROW_DOWN:
            this.avr.remoteKey('DOWN');
            break;
        case Characteristic.RemoteKey.ARROW_LEFT:
            this.avr.remoteKey('LEFT');
            break;
        case Characteristic.RemoteKey.ARROW_RIGHT:
            this.avr.remoteKey('RIGHT');
            break;
        case Characteristic.RemoteKey.SELECT:
            this.avr.remoteKey('ENTER');
            break;
        case Characteristic.RemoteKey.BACK:
            this.avr.remoteKey('RETURN');
            break;
        case Characteristic.RemoteKey.EXIT:
            this.avr.remoteKey('RETURN');
            break;
        case Characteristic.RemoteKey.PLAY_PAUSE:
            this.log.info('Play/Pause remote key not implemented');
            break;
        case Characteristic.RemoteKey.INFORMATION:
            this.avr.remoteKey('HOME_MENU');
            break;
    }
    callback();
};


pioneerAvrAccessory.prototype.getServices = function() {
    // This method is called once on startup. We need to wait for accessory to be ready
    // ie all inputs are created
    while (this.avr.isReady == false) {
        require('deasync').sleep(500);
        this.log.debug('Waiting for pioneerAvrAccessory to be ready');
    }

    this.log.info('Accessory %s ready', this.name);
    this.log.debug('Enabled services : %s', this.enabledServices.length);

    return this.enabledServices;
};
