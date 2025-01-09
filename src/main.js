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
} from '@nodegui/nodegui';
import * as path from "node:path";
import sourceMapSupport from 'source-map-support';

import * as fs from "node:fs";
import { tap, map, filter, switchMap } from "rxjs/operators";
import { Ports } from '@slippi/slippi-js';
import {
  ConnectionStatus, 
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

const _STATES_ = () => {
  const state1 = {
    inSettings: false,
    hasConnection: false,
    inGame: false,
    falcos: {
      1: [2, 'n']
    },
  };
};

const G = {
  games: {}
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

function main() {
  const mainLayout = new QBoxLayout(Direction.TopToBottom);
  const falcos = [makeFalco(1), makeFalco(2), makeFalco(3), makeFalco(4)];

  const win = new QMainWindow();
  win.setWindowTitle("slp-lasik");

  const centralWidget = new QWidget();
  centralWidget.setLayout(mainLayout);
  centralWidget.setObjectName("app");

  const colorDialog = new QColorDialog();
  colorDialog.setCurrentColor(new QColor('black'));

  mainLayout.addStretch(0);
  mainLayout.addWidget(falcos[0]);
  mainLayout.addWidget(falcos[1]);
  mainLayout.addWidget(falcos[2]);
  mainLayout.addWidget(falcos[3]);
  mainLayout.addStretch(0);
  win.setCentralWidget(centralWidget);
  win.setStyleSheet(
  `
    #app {
      background-color: #10010c;
    }
    #count1, #port1 {
      font-size: 18px;
      color: #f15959;
    }
    #count2, #port2 {
      font-size: 18px;
      color: #6565fe;
    }
    #count3, #port3 {
      font-size: 18px;
      color: #febe3f;
    }
    #count4, #port4 {
      font-size: 18px;
      color: #4ce44c;
    }
  `
  );
  win.show();
  global.win = win;

  /*
  const livestream = new SlpLiveStream(connectionType, {
    outputFiles: false,
  });

  livestream.start(ADDRESS, PORT)
    .then(() => { label2.setText("Connected to Slippi"); })
    .catch(() => { label2.setText("an error occured"); });
  const stream$ = new ReplaySubject();
  stream$.next(livestream);
  const frame$ = stream$.pipe(switchMap((stream) => stream.playerFrame$));
  // frame$.subscribe((frame) => console.error(frame));
  const start$ = stream$.pipe(switchMap((stream) => stream.gameStart$));
  const end$ = stream$.pipe(switchMap((stream) => stream.gameEnd$));
  start$.subscribe((start) => console.error(start));
  end$.subscribe((end) => console.error(end));
  */

  console.error("set up click handler");
  colorDialog.setOption(0x00000001, true);
  colorDialog.addEventListener('colorSelected', (e) => {
    console.log(e);
    console.log([
      e.red(),
      e.blue(),
      e.green(),
      e.alpha(),
    ]);
  })
  centralWidget.addEventListener(WidgetEventTypes.MouseButtonPress, (native) => {
    const e = new QMouseEvent(native);
    if (e.button() == 2) {
      colorDialog.exec();
    }
  });
}
main();
