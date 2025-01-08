import { 
  QMainWindow, QWidget, QLabel, QPushButton, QIcon, QBoxLayout, Direction
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

const G = {
  games: {}
};

function main() {
  const win = new QMainWindow();
  win.setWindowTitle("Hello World!!!!");

  const centralWidget = new QWidget();

  const rootLayout = new QBoxLayout(Direction.TopToBottom);
  centralWidget.setObjectName("myroot");
  centralWidget.setLayout(rootLayout);

  const label = new QLabel();
  label.setObjectName("mylabel");
  label.setText("Hello");

  const button = new QPushButton();
  button.setIcon(new QIcon(path.join(__dirname, '../assets/logox200.png')));

  const label2 = new QLabel();
  label2.setText("connecting...");
  label2.setInlineStyle(`
    color: red;
  `);

  rootLayout.addWidget(label);
  rootLayout.addWidget(button);
  rootLayout.addWidget(label2);
  win.setCentralWidget(centralWidget);
  win.setStyleSheet(
  `
    #myroot {
      background-color: #009688;
      height: '100%';
      align-items: 'center';
      justify-content: 'center';
    }
    #mylabel {
      font-size: 16px;
      font-weight: bold;
      padding: 1;
    }
  `
  );
  win.show();
  global.win = win;

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
}
main();
