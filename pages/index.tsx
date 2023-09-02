import * as React from 'react';

import { Box, Container, IconButton, List, Option, Select, Sheet, Stack, Typography, useColorScheme, useTheme } from '@mui/joy';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import Face6Icon from '@mui/icons-material/Face6';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import SmartToyTwoToneIcon from '@mui/icons-material/SmartToyTwoTone';

import { ChatMessage, UiMessage } from '../components/ChatMessage';
import { Composer } from '../components/Composer';
import { isValidOpenAIApiKey, loadGptModel, loadOpenAIApiKey, Settings } from '../components/Settings';


/// Purpose configuration

type SystemPurpose = 'Catalyst' | 'Custom' | 'Developer' | 'Executive' | 'Generic' | 'Scientist';

const PurposeData: { [key in SystemPurpose]: { systemMessage: string; description: string | JSX.Element } } = {
  Catalyst: {
    systemMessage: 'You are a smart contract security researcher, you have been set a task to write a short report on a smart contract pasted below, write a summary on how they could improve gas optimisation also include the code for any advised changes and reccomendations, the report must contain a front page (name of contract, language and language version with the current date) and contents page.',
    description: 'Gas Optimisation Report 🚀',
  },
  Custom: {
    systemMessage: 'You are a smart contract security researcher, you have been set a task to write a full report on a smart contract pasted below, write a summary of the contract functions, edge cases, vulnerbilities and attack vectors, also include the code for any advised changes and reccomendations, the report must contain a front page (name of contract, language and language version with the current date) and contents page.',
    description: 'Full Comprehensive Report',
  },
  Developer: {
    systemMessage: 'You are a smart contract security researcher, you have been set a task to write a short report on a smart contract pasted below, write a summary on any edge cases present also include the code for any advised changes and reccomendations, the report must contain a front page (name of contract, language and language version with the current date) and contents page.',
    description: 'Edge Case Report',
  },
  Executive: {
    systemMessage: 'You are a smart contract security researcher, you have been set a task to write a short report on a smart contract pasted below, write a summary on any attack vectors present also include the code for any advised changes and reccomendations, the report must contain a front page (name of contract, language and language version with the current date) and contents page.',
    description: 'Attack Vector Report',
  },
  Generic: {
    systemMessage: 'You are a smart contract security researcher, you have been set a task to write a short report on a smart contract pasted below, write a summary of the contract functions, edge cases, vulnerbilities and attack vectors, also include the code for any advised changes and reccomendations, the report must contain a front page (name of contract, language and language version with the current date) and contents page.',
    description: 'Simple Audit Report',
  },
  Scientist: {
    systemMessage: 'You are a smart contract security researcher, you have been set a task to write a short report on a smart contract pasted below, write a summary on any vulnberbilities present also include the code for any advised changes and reccomendations, the report must contain a front page (name of contract, language and language version with the current date) and contents page.',
    description: 'Vulnerability Report',
  },
};


/// UI Messages configuration

const MessageDefaults: { [key in UiMessage['role']]: Pick<UiMessage, 'role' | 'sender' | 'avatar'> } = {
  system: {
    role: 'system',
    sender: 'Bot',
    avatar: SmartToyTwoToneIcon, //'https://em-content.zobj.net/thumbs/120/apple/325/robot_1f916.png',
  },
  user: {
    role: 'user',
    sender: 'You',
    avatar: Face6Icon, //https://mui.com/static/images/avatar/2.jpg',
  },
  assistant: {
    role: 'assistant',
    sender: 'Bot',
    avatar: SmartToyOutlinedIcon, // 'https://www.svgrepo.com/show/306500/openai.svg',
  },
};

const createUiMessage = (role: UiMessage['role'], text: string): UiMessage => ({
  uid: Math.random().toString(36).substring(2, 15),
  text: text,
  model: '',
  ...MessageDefaults[role],
});


/// Chat ///

export default function Conversation() {
  const theme = useTheme();
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const [selectedSystemPurpose, setSelectedSystemPurpose] = React.useState<SystemPurpose>('Generic');
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [disableCompose, setDisableCompose] = React.useState(false);
  const [settingsShown, setSettingsShown] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => {
    // show the settings at startup if the API key is not present
    if (!isValidOpenAIApiKey(loadOpenAIApiKey()))
      setSettingsShown(true);
  }, []);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');


  const handleListClear = () => setMessages([]);

  const handleListDelete = (uid: string) =>
    setMessages(list => list.filter(message => message.uid !== uid));

  const handleListEdit = (uid: string, newText: string) =>
    setMessages(list => list.map(message => (message.uid === uid ? { ...message, text: newText } : message)));

  const handleListRunAgain = (uid: string) => {
    // take all messages until we get to uid, then remove the rest
    const uidPosition = messages.findIndex(message => message.uid === uid);
    if (uidPosition === -1) return;
    const conversation = messages.slice(0, uidPosition + 1);
    setMessages(conversation);

    // disable the composer while the bot is replying
    setDisableCompose(true);
    getBotMessageStreaming(conversation)
      .then(() => setDisableCompose(false));
  };

  const handlePurposeChange = (purpose: SystemPurpose | null) => {
    if (!purpose) return;

    if (purpose === 'Custom') {
      const systemMessage = prompt('Enter your custom AI purpose', PurposeData['Custom'].systemMessage);
      PurposeData['Custom'].systemMessage = systemMessage || '';
    }

    setSelectedSystemPurpose(purpose);
  };


  const getBotMessageStreaming = async (messages: UiMessage[]) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: loadOpenAIApiKey(), model: loadGptModel(), messages: messages }),
    });

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      const newBotMessage: UiMessage = createUiMessage('assistant', '');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const messageText = decoder.decode(value);
        newBotMessage.text += messageText;

        // there may be a JSON object at the beginning of the message, which contains the model name (streaming workaround)
        if (!newBotMessage.model && newBotMessage.text.startsWith('{')) {
          const endOfJson = newBotMessage.text.indexOf('}');
          if (endOfJson > 0) {
            const json = newBotMessage.text.substring(0, endOfJson + 1);
            try {
              const parsed = JSON.parse(json);
              newBotMessage.model = parsed.model;
              newBotMessage.text = newBotMessage.text.substring(endOfJson + 1);
            } catch (e) {
              // error parsing JSON, ignore
              console.log('Error parsing JSON: ' + e);
            }
          }
        }

        setMessages(list => {
          // if missing, add the message at the end of the list, otherwise set a new list anyway, to trigger a re-render
          const message = list.find(message => message.uid === newBotMessage.uid);
          return !message ? [...list, newBotMessage] : [...list];
        });
      }
    }
  };

  const handleComposerSendMessage: (text: string) => void = (text) => {

    // seed the conversation with a 'system' message
    const conversation = [...messages];
    if (!conversation.length) {
      let systemMessage = PurposeData[selectedSystemPurpose].systemMessage;
      systemMessage = systemMessage.replaceAll('{{Today}}', new Date().toISOString().split('T')[0]);
      conversation.push(createUiMessage('system', systemMessage));
    }

    // add the user message
    conversation.push(createUiMessage('user', text));

    // update the list of messages
    setMessages(conversation);

    // disable the composer while the bot is replying
    setDisableCompose(true);
    getBotMessageStreaming(conversation)
      .then(() => setDisableCompose(false));
  };


  const listEmpty = !messages.length;

  const Emoji = (props: any) => null;

  const customColors = {
  primary: "#000",
};

  return (
    <Container maxWidth='xl' disableGutters sx={{
      boxShadow: theme.vars.shadow.lg,
    }}>
      <Stack direction='column' sx={{
        minHeight: '100vh',
      }}>

        {/* Application Bar */}
        <Sheet variant='solid' invertedColors sx={{
          position: 'sticky', top: 0, zIndex: 20, p: 1,
          background: customColors.primary,
          display: 'flex', flexDirection: 'row',
        }}>
          <IconButton variant='plain' color='neutral' onClick={handleDarkModeToggle}>
            <DarkModeIcon />
          </IconButton>

          {/*{!isEmpty && (*/}
          {/*  <IconButton variant='plain' color='neutral' disabled={isDisabledCompose} onClick={onClearConversation}>*/}
          {/*    <DeleteOutlineOutlinedIcon />*/}
          {/*  </IconButton>*/}
          {/*)}*/}

          <Typography sx={{
            textAlign: 'center',
            fontFamily: theme.vars.fontFamily.code, fontSize: '1rem', lineHeight: 1.75,
            my: 'auto',
            flexGrow: 1,
          }} onDoubleClick={handleListClear}>
            boolai
          </Typography>

          <IconButton variant='plain' color='neutral' onClick={() => setSettingsShown(true)}>
            <SettingsOutlinedIcon />
          </IconButton>
        </Sheet>

        {/* Chat */}
        <Box sx={{
          flexGrow: 1,
          background: theme.vars.palette.background.level1,
        }}>
          {listEmpty ? (
            <Stack direction='column' sx={{ alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
              <Box>
                <Typography level='body3' color='neutral'>
                  AI purpose
                </Typography>
                <Select value={selectedSystemPurpose} onChange={(e, v) => handlePurposeChange(v)} sx={{ minWidth: '40vw' }}>
                  <Option value='Generic'><Emoji>🧠</Emoji> Simple Report</Option>
                  <Option value='Developer'><Emoji>👩‍💻</Emoji> Edge Cases</Option>
                  <Option value='Scientist'><Emoji>🔬</Emoji> Vulnerbilities</Option>
                  <Option value='Executive'><Emoji>👔</Emoji> Attack Vectors</Option>
                  <Option value='Catalyst'><Emoji>🚀</Emoji> Gas Optimisation</Option>  
                  <Option value='Custom'><Emoji>✨</Emoji> Comprehensive Report</Option>
                </Select>
                <Typography level='body2' sx={{ mt: 2, minWidth: 260 }}>
                  {PurposeData[selectedSystemPurpose].description}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <>
              <List sx={{ p: 0 }}>
                {messages.map((message, index) =>
                  <ChatMessage key={'msg-' + message.uid} uiMessage={message}
                               onDelete={() => handleListDelete(message.uid)}
                               onEdit={newText => handleListEdit(message.uid, newText)}
                               onRunAgain={() => handleListRunAgain(message.uid)} />)}
                <div ref={messagesEndRef}></div>
              </List>
            </>
          )}
        </Box>

        {/* Compose */}
        <Box sx={{
          position: 'sticky', bottom: 0, zIndex: 10,
          background: theme.vars.palette.background.body,
          borderTop: '1px solid',
          borderTopColor: theme.vars.palette.divider,
          p: { xs: 1, md: 2 },
        }}>
          <Composer isDeveloper={selectedSystemPurpose === 'Developer'} disableSend={disableCompose} sendMessage={handleComposerSendMessage} />
        </Box>

      </Stack>

      {/* Settings Modal */}
      <Settings open={settingsShown} onClose={() => setSettingsShown(false)} />

    </Container>
  );
}