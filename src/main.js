import { 
  QMainWindow, 
  QWidget, 
  QLabel, 
  QPushButton, 
  QIcon, 
  QBoxLayout, 
  Direction, 
  WidgetEventTypes,
  QMouseEvent,
  QColor,
  QColorDialog,
  QPixmap,
  QCheckBox,
  QLineEdit,
  WidgetAttribute,
  WindowType,
} from '@nodegui/nodegui';
import * as path from "node:path";
import sourceMapSupport from 'source-map-support';

import * as fs from "node:fs";
import { tap, map, filter, switchMap } from "rxjs/operators";
import { Ports, ConnectionEvent, ConnectionStatus } from '@slippi/slippi-js';
import {
  SlpLiveStream, 
  SlpRealTime, 
  ComboFilter, 
  generateDolphinQueuePayload,
  forAllPlayerIndices,
} from "@vinceau/slp-realtime";
import { ReplaySubject } from "rxjs";

sourceMapSupport.install();

const ADDRESS = "127.0.0.1";
const PORT = Ports.DEFAULT;
const connectionType = "dolphin";

const G = {
  stream$: new ReplaySubject(),
  state: {
    bgcolor: 'rgba(15, 1, 12, 255)',
    fontsize: 18,
    inSettings: false,
    inGame: false,
    isConnecting: true,
    hasConnection: false,
    isDark: true,
  },
};

const falcoImages = {};
const addImage = (k) => {
  const imagePath = path.join(__dirname, '../assets/falco_' + k + '.png');
  const image = new QPixmap();
  image.load(imagePath);
  falcoImages[k] = image;
};
(["n", "r", "g", "b"]).forEach((k) => addImage(k));

const makeFalco = (port) => {
  const row = new QWidget();
  const rowlayout = new QBoxLayout(Direction.LeftToRight);
  const portlabel = new QLabel();
  portlabel.setObjectName(`port${port}`);
  portlabel.setText(`p${port}`);
  const iconlabel = new QLabel();
  iconlabel.setPixmap(falcoImages.r);
  const countlabel = new QLabel();
  countlabel.setObjectName(`count${port}`);
  countlabel.setText(0);
  rowlayout.addStretch(0);
  rowlayout.addWidget(portlabel);
  rowlayout.addWidget(iconlabel);
  rowlayout.addWidget(countlabel);
  rowlayout.addStretch(0);
  row.setLayout(rowlayout);
  row.setCount = (n) => countlabel.setText(n);
  row.setCostume = (k) => iconlabel.setPixmap(falcoImages[k]);
  return row;
};

const makeDisconnected = () => {
  const row = new QWidget();
  const rowlayout = new QBoxLayout(Direction.LeftToRight);
  const label = new QLabel();
  label.setObjectName('disconnected');
  label.setText('slippi disconnected');
  rowlayout.addStretch(0);
  rowlayout.addWidget(label);
  rowlayout.addStretch(0);
  row.setLayout(rowlayout);
  return row;
};

const makeNoFalcos = () => {
  const row = new QWidget();
  const rowlayout = new QBoxLayout(Direction.LeftToRight);
  const label = new QLabel();
  label.setObjectName('none');
  label.setText('no falcos in game');
  rowlayout.addStretch(0);
  rowlayout.addWidget(label);
  rowlayout.addStretch(0);
  row.setLayout(rowlayout);
  return row;
};

const makeNotInGame = () => {
  const row = new QWidget();
  const rowlayout = new QBoxLayout(Direction.LeftToRight);
  const label = new QLabel();
  label.setObjectName('waiting');
  label.setText('not in game');
  rowlayout.addStretch(0);
  rowlayout.addWidget(label);
  rowlayout.addStretch(0);
  row.setLayout(rowlayout);
  return row;
};

const makeCloseButtons = () => {
  const row = new QWidget();
  const rowlayout = new QBoxLayout(Direction.LeftToRight);

  const closeButton = new QPushButton();
  closeButton.setObjectName('close');
  closeButton.setText('close app');

  const closeSettingsButton = new QPushButton();
  closeSettingsButton.setObjectName('closesettings');
  closeSettingsButton.setText('close settings');
  
  rowlayout.addStretch(0);
  rowlayout.addWidget(closeSettingsButton);
  rowlayout.addWidget(closeButton);
  rowlayout.addStretch(0);
  row.setLayout(rowlayout);
  row.buttons = { closeButton, closeSettingsButton };
  return row;
};

const getStylesheet = (state) => {
  const T = state.isDark ? {
    w: '#e4e4e4',
    r: '#f15959',
    g: '#4ce44c',
    y: '#febe3f',
    b: '#6565fe',
  } : {
    w: '#303030',
    r: '#732a2a',
    g: '#216321',
    y: '#4d3913',
    b: '#333380',
  };
  const statusColor = state.hideStatus ? '#00000000' : T.w;
  return `
    #app {
      background-color: ${state.bgcolor};
    }
    #none, #disconnected, #waiting {
      font-size: ${state.fontsize}px;
      color: ${statusColor};
    }
    #status, #fontsize {
      font-size: ${state.fontsize}px;
      color: ${T.w};
    }
    #pickbg, #close, #closesettings, #fontsizeedit {
      font-size: ${state.fontsize}px;
    }
    #count1, #port1 {
      font-size: ${state.fontsize}px;
      color: ${T.r};
    }
    #count2, #port2 {
      font-size: ${state.fontsize}px;
      color: ${T.b};
    }
    #count3, #port3 {
      font-size: ${state.fontsize}px;
      color: ${T.y};
    }
    #count4, #port4 {
      font-size: ${state.fontsize}px;
      color: ${T.g};
    }
  `;
};

const updateView = (widgets, state) => {
  if (state.inSettings) {
    widgets.disconnected.hide();
    widgets.noFalcos.hide();
    widgets.notInGame.hide();
    for (k in widgets.falcos) {
      widgets.falcos[k].hide();
    }
    widgets.showStatusText.show();
    widgets.pickBgButton.show();
    widgets.fontsizeEdit.show();
    widgets.closeButtons.show();
  } else if (!state.hasConnection) {
    widgets.disconnected.show();
    widgets.noFalcos.hide();
    widgets.notInGame.hide();
    for (k in widgets.falcos) {
      widgets.falcos[k].hide();
    }
  } else if (!state.inGame) {
    widgets.disconnected.hide();
    widgets.noFalcos.hide();
    widgets.notInGame.show();
    for (k in widgets.falcos) {
      widgets.falcos[k].hide();
    }
  } else {
    widgets.disconnected.hide();
    widgets.notInGame.hide();
    let anyFalcos = false;
    for (k in widgets.falcos) {
      if (state.falcos[k]) {
        anyFalcos = true;
        widgets.falcos[k].setCount(state.falcos[k][0]);
        widgets.falcos[k].setCostume(state.falcos[k][1]);
        widgets.falcos[k].show();
      } else {
        widgets.falcos[k].hide();
      }
    }
    (anyFalcos ? 
      (() => widgets.noFalcos.hide()) :
      (() => widgets.noFalcos.show()))();
  }
  if (!state.inSettings) {
    widgets.showStatusText.hide();
    widgets.pickBgButton.hide();
    widgets.fontsizeEdit.hide();
    widgets.closeButtons.hide();
  }
  widgets.window.setStyleSheet(getStylesheet(state));
  widgets.window.show();
};

const makeFontsizeEdit = () => {
  const row = new QWidget();
  const rowlayout = new QBoxLayout(Direction.LeftToRight);


  const fontsizeLabel = new QLabel();
  fontsizeLabel.setObjectName('fontsize');
  fontsizeLabel.setText('font size');

  const fontsizeEdit = new QLineEdit();
  fontsizeEdit.setObjectName('fontsizeedit');
  fontsizeEdit.setText(18);
  
  rowlayout.addStretch(0);
  rowlayout.addWidget(fontsizeLabel);
  rowlayout.addWidget(fontsizeEdit);
  rowlayout.addStretch(0);
  row.setLayout(rowlayout);
  row.edit = fontsizeEdit;
  return row;
};

const setupChecker = (widgets) => {
  const checkLivestream = () => {
    if (G.livestream) { return; }
    G.state.isConnecting = true;
    G.state.hasConnection = false;
    G.livestream = new SlpLiveStream(connectionType, {
      outputFiles: false,
    });
  
    G.livestream.start(ADDRESS, PORT)
      .then(() => {
        G.state.hasConnection = true;
        G.state.inGame = false;
        G.stream$.next(G.livestream);
        updateView(widgets, G.state);
      })
      .catch((e) => { 
        G.state.hasConnection = false;
        G.livestream = null;
        updateView(widgets, G.state);
        console.error("an error occured", e);
      });
    const onStatusChange = (status) => {
      if (status === ConnectionStatus.DISCONNECTED) {
        G.state.hasConnection = false;
        G.livestream = null;
        updateView(widgets, G.state);
      }
    };
    G.livestream.connection.on(ConnectionEvent.STATUS_CHANGE, onStatusChange);
    updateView(widgets, G.state);
  };
  setInterval(checkLivestream, 5000);
};

function main() {
  const mainLayout = new QBoxLayout(Direction.TopToBottom);
  const falcos = { 
    1: makeFalco(1), 2: makeFalco(2), 3: makeFalco(3), 4: makeFalco(4)
  };

  const window = new QMainWindow();
  window.setAttribute(WidgetAttribute.WA_TranslucentBackground, true);
  window.setWindowFlag(WindowType.FramelessWindowHint, true);
  window.setWindowTitle("slp-lasik");
  const icon = new QIcon(path.join(__dirname, '../assets/falco_n.png'));
  window.setWindowIcon(icon);

  const centralWidget = new QWidget();
  centralWidget.setLayout(mainLayout);
  centralWidget.setObjectName("app");

  const colorDialog = new QColorDialog();
  colorDialog.setCurrentColor(new QColor('black'));

  const disconnected = makeDisconnected();
  const noFalcos = makeNoFalcos();
  const notInGame = makeNotInGame();

  const showStatusText = new QCheckBox();
  showStatusText.setObjectName('status');
  showStatusText.setText('Hide status text');

  const pickBgButton = new QPushButton();
  pickBgButton.setObjectName('pickbg');
  pickBgButton.setText('Set background color');

  const fontsizeEdit = makeFontsizeEdit();

  const closeButtons = makeCloseButtons();

  mainLayout.addStretch(0);
  mainLayout.addSpacing(25);
  mainLayout.addWidget(showStatusText);
  mainLayout.addWidget(pickBgButton);
  mainLayout.addWidget(fontsizeEdit);
  mainLayout.addWidget(closeButtons);
  mainLayout.addWidget(disconnected);
  mainLayout.addWidget(noFalcos);
  mainLayout.addWidget(notInGame);
  mainLayout.addWidget(falcos[1]);
  mainLayout.addWidget(falcos[2]);
  mainLayout.addWidget(falcos[3]);
  mainLayout.addWidget(falcos[4]);
  mainLayout.addSpacing(25);
  mainLayout.addStretch(0);
  window.setCentralWidget(centralWidget);

  const widgets = {
    window, 
    falcos, 
    disconnected, 
    noFalcos, 
    notInGame,
    showStatusText,
    pickBgButton,
    fontsizeEdit,
    closeButtons,
  };

  showStatusText.addEventListener('clicked', (checked) => {
    G.state.hideStatus = checked;
    updateView(widgets, G.state);
  });

  updateView(widgets, G.state);
  setupChecker(widgets);

  const frame$ = G.stream$.pipe(switchMap((stream) => stream.playerFrame$));
  frame$.subscribe((frame) => {
    for (const k in G.state.falcos) {
      const [_l, _c, playerIndex, loopStateId, loopCount] = G.state.falcos[k];
      const playerFrame = frame.players[playerIndex] || { post: {} };
      const currStateId = (playerFrame.post || {}).actionStateId;
      const isGroundLoop = currStateId === 342;
      const isAirLoop = currStateId === 345;
      if (currStateId === loopStateId) {
        G.state.falcos[k][4]++;
        if (isGroundLoop) {
          G.state.falcos[k][4] = G.state.falcos[k][4] % 24;
        } else {
          G.state.falcos[k][4] = G.state.falcos[k][4] % 16;
        }
      } else if (isAirLoop || isGroundLoop) {
        G.state.falcos[k][3] = currStateId;
        G.state.falcos[k][4] = 1;
      } else {
        G.state.falcos[k][3] = null;
        G.state.falcos[k][4] = 0;
      }
      const currCount = G.state.falcos[k][4];
      const isNewGroundLaser = isGroundLoop && (currCount === 16);
      const isNewAirLaser = isAirLoop && (currCount === 8);
      if (isNewGroundLaser || isNewAirLaser) {
        G.state.falcos[k][0]++;
        updateView(widgets, G.state);
      }
    }
  });
  const start$ = G.stream$.pipe(switchMap((stream) => stream.gameStart$));
  start$.subscribe((start) => {
    G.state.inGame = true;
    G.state.falcos = {};
    for (const player of start.players) {
      if (player.characterId === 20) {
        const colById = ['n', 'r', 'b', 'g'];
        G.state.falcos[player.port] = [
          0, colById[player.characterColor], player.playerIndex
        ];
      }
    }
    updateView(widgets, G.state);
  });

  colorDialog.setOption(0x00000001, true);
  colorDialog.addEventListener('colorSelected', (e) => {
    const bgcolor = (
      `rgba(${e.red()}, ${e.green()}, ${e.blue()}, ${Math.max(2, e.alpha())})`
    );
    const avg = (e.red() + e.green() + e.blue()) / 3;
    G.state.bgcolor = bgcolor;
    G.state.isDark = avg < 128;
    updateView(widgets, G.state);
  })

  const mousePos = (e) => {
    const { x, y } = window.pos();
    return { x: x + e.x(), y: y + e.y() };
  };

  closeButtons.buttons.closeSettingsButton.addEventListener(
    WidgetEventTypes.MouseButtonPress, 
    (native) => {
      const e = new QMouseEvent(native);
      if (e.button() == 1) {
        G.state.inSettings = false;
        updateView(widgets, G.state);
      };
    }
  );

  closeButtons.buttons.closeButton.addEventListener(
    WidgetEventTypes.MouseButtonPress, 
    (native) => {
      const e = new QMouseEvent(native);
      if (e.button() == 1) {
        window.close();
      };
    }
  );

  centralWidget.addEventListener(
    WidgetEventTypes.MouseButtonPress, 
    (native) => {
      const e = new QMouseEvent(native);
      if (e.button() == 1) {
        G.dragging = true;
        G.draggingStartMouse = mousePos(e);
        G.draggingStartWindow = { ...window.pos() };

      };
      if (e.button() == 2) {
        G.state.inSettings = true;
        updateView(widgets, G.state);
      }
    }
  );
  centralWidget.addEventListener(
    WidgetEventTypes.MouseButtonRelease, 
    (native) => {
      const e = new QMouseEvent(native);
      if (e.button() == 1) {
        G.dragging = false;
      };
    }
  );
  centralWidget.addEventListener(
    WidgetEventTypes.MouseMove, 
    (native) => {
      if (!G.dragging) { return; }
      const e = new QMouseEvent(native);
      const newMousePos = mousePos(e);
      const offx = newMousePos.x - G.draggingStartMouse.x;
      const offy = newMousePos.y - G.draggingStartMouse.y;
      window.move(
        offx + G.draggingStartWindow.x, offy + G.draggingStartWindow.y
      );
    }
  );
  pickBgButton.addEventListener(
    WidgetEventTypes.MouseButtonPress, 
    (native) => {
      const e = new QMouseEvent(native);
      if (e.button() == 1) {
        colorDialog.exec();
      }
    }
  );
  fontsizeEdit.edit.addEventListener('editingFinished', () => {
    try {
      const fontsize = parseInt(fontsizeEdit.edit.text());
      if (Number.isNaN(fontsize)) { throw new Error(); }
      G.state.fontsize = fontsize;
      updateView(widgets, G.state);
    } catch (e) {}
  });
}
main();
