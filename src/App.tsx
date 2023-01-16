import React, { ReactNode, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { routerQuery, getRandomColor } from './util';
import textAreaSyncToYText from './textAreaSyncToYText';
import useYText from './useYText';
import './App.css';

const TEXT_NAME = 'textarea-demo';
const ROOM_NAME = 'textarea-co-room';

const doc = new Y.Doc();
// @ts-ignore
window.doc = doc;

const initialValue = 'Yjs textarea playground';
function TextAreCoEditor() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {yText, undoManager} = useYText({name: TEXT_NAME, doc});
  const [fragments, setFragments] = useState<ReactNode[]>([]);

  useEffect(() => {
    const db = new IndexeddbPersistence('textAreaDemo', doc);
    db.on('synced', (idbPersistence: IndexeddbPersistence) => {
      if (textareaRef.current) {
        textareaRef.current.value = yText.toString() || initialValue;
      }
    });

    const wsProvider = new WebsocketProvider('ws://localhost:1234', ROOM_NAME, doc, {connect: true});
    wsProvider.on('status', (event: any) => {
      if (event.status === 'connected') {
        console.log('wsProvider成功连接✅');
      } else {
        console.log('wsProvider断开连接❌');
      }
    });

    const {awareness} = wsProvider;
    awareness.setLocalState({
      user: {
        name: routerQuery().username ?? `游客${Date.now().toString().slice(-5)}`,
        color: getRandomColor(),
        id: doc.clientID,
      },
      selectionRange: [0, 0],
    });
    awareness.on('change', (changes: []) => {
      let currentStates = Array.from(awareness.getStates().values());
      const text = yText.toString();
      const _fragments: ReactNode[] = [];
      let lastPosition = 0;
      if (currentStates.length > 1) {
        currentStates = currentStates.sort((state1, state2) => state1.selectionRange[0] - state2.selectionRange[0]);
      }
      currentStates.forEach((state) => {
        const {selectionRange, user} = state;
        if (selectionRange && user.id !== doc.clientID) {
          const [cursorPosition, end] = selectionRange;
          if (cursorPosition === lastPosition) {
            return;
          }
          const content = text.slice(lastPosition, cursorPosition);
          lastPosition = cursorPosition;
          _fragments.push(
            <div
              className='fake-content hidden'
              key={user.id}>
              {content}
            </div>,
          );
          _fragments.push(
            <span
              className='cursor'
              key={`${user.id}-cursor`}
              // @ts-ignore
              style={{'--cursor-color': user.color}}
              >
              <div className='cursor-label'>{user.name}</div>
            </span>,
          );
        }
      });
      setFragments(_fragments);
    });
    let unlisten = () => {};
    if (textareaRef.current) {
      unlisten = textAreaSyncToYText({yText, textarea: textareaRef.current, undoManager, awareness});
    }
    return () => {
      wsProvider.destroy();
      unlisten();
    };
  }, []);

  return (
    <div className='co-edit-textarea-wrapper'>
      <textarea
        className='co-edit-textarea'
        ref={textareaRef}
        rows={20} />
      <div className="input overlay">{fragments}</div>
    </div>
  );
}

export default TextAreCoEditor;