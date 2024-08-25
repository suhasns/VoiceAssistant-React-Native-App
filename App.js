import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  SafeAreaView,
  Platform,
  PermissionsAndroid,
  LogBox,
} from 'react-native';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import FastImage from 'react-native-fast-image';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [isMicDisabled, setIsMicDisabled] = useState(false);
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);
  const scrollViewRef = useRef();

  useEffect(() => {
    LogBox.ignoreLogs(['new NativeEventEmitter']);
    LogBox.ignoreAllLogs();

    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = (error) => console.log('onSpeechError:', error);

    const handleTTSStart = () => setIsTTSSpeaking(true);
    const handleTTSFinish = () => setIsTTSSpeaking(false);
    const handleTTSCancel = () => setIsTTSSpeaking(false);

    Tts.addEventListener('tts-start', handleTTSStart);
    Tts.addEventListener('tts-finish', handleTTSFinish);
    Tts.addEventListener('tts-cancel', handleTTSCancel);

    const checkAndroidPermission = async () => {
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (!hasPermission) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Permission denied');
          }
        }
      }
    };

    checkAndroidPermission();

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      Tts.removeEventListener('tts-start', handleTTSStart);
      Tts.removeEventListener('tts-finish', handleTTSFinish);
      Tts.removeEventListener('tts-cancel', handleTTSCancel);
    };
  }, []);

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  const onSpeechStart = (event) => {
    console.log('recording Started...!!!', event);
  };

  const onSpeechEnd = () => {
    console.log('recording Ended.');
    setIsListening(false);
  };

  const onSpeechResults = (event) => {
    const text = event.value[0];
    setRecognizedText(text);

    setTimeout(() => {
      sendMessage(text);
      setRecognizedText('');
    }, 1000);
  };

  const startListening = async () => {
    setIsListening(true);
    setRecognizedText('Listening...');
    try {
      await Voice.start('en-US');
    } catch (error) {
      console.log('Error in listening - Startlistening', error);
      setIsListening(false);
      setRecognizedText('');
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (error) {
      console.log('Error in listening - Stoplistening', error);
      setIsListening(false);
    }
  };

  const getResponseFromAzureOpenAI = async (message) => {
    setIsMicDisabled(true);
    try {
      const res = await fetch('https://copilot-service-v1.azurewebsites.net/get-service-response', {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': 'ce272616f5fe4e7fa4be13081e2be769',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request: message
        }),
      });
      const json = await res.json();
      
      setIsMicDisabled(false);
      Tts.speak(json.Response);
      return json.Response; 
      
    } catch (error) {
      console.error('Error fetching response from Azure OpenAI:', error);
      setIsMicDisabled(false);
      return 'Sorry, I am unable to respond at the moment.';
    }
  };

  const sendMessage = async (message) => {
    if (message) {
      const newMessage = { text: message, sender: 'user' };
      setMessages((prevMessages) => [...prevMessages, newMessage]);

      const aiResponse = await getResponseFromAzureOpenAI(newMessage.text);
      setMessages((prevMessages) => [...prevMessages, { text: aiResponse, sender: 'bot' }]);

      scrollToBottom();
    }
  };

  const stopTTS = () => {
    Tts.stop();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView />
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Voice Assistant</Text>
      </View>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              {
                alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            {message.sender === 'bot' && (
              <FastImage
                style={styles.avatar}
                source={require('./assests/more.gif')}
              />
            )}
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder=""
          placeholderTextColor="#888"
          value={recognizedText}
          onChangeText={(text) => setRecognizedText(text)}
          editable={false}
        />
        {isTTSSpeaking ? (
          <TouchableOpacity onPress={stopTTS} style={styles.stopButton}>
            <Image source={require('./assests/stop-button.png')} style={styles.stopIcon} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              isListening ? stopListening() : startListening();
            }}
            style={[styles.voiceButton, isListening && styles.listeningButton, isMicDisabled && { opacity: 0.1, backgroundColor: '#CCCCCC' }]}
            disabled={isMicDisabled}
          >
            <FastImage
              source={isListening ? require('./assests/wave-sound_1.png') : require('./assests/podcast_1.gif')}
              style={isListening ? styles.podcastIcon : styles.microphoneIcon}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesContainer: {
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 24,
    fontFamily: 'Roboto-Bold',
    color: '#009999',
    letterSpacing: 3,
  },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '85%',
    marginVertical: 15,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderColor: 'black',
    borderWidth: 2,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#333333',
    marginLeft: 10,
    flexShrink: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    borderRadius: 25,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Roboto-Regular',
    paddingHorizontal: 25,
    paddingVertical: 20,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    color: '#333333',
    borderWidth: 2,
    borderColor: '#009999',
    marginRight: 10,
  },
  voiceButton: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 15,
  },
  listeningButton: {
    alignItems: 'center',
    flexShrink: 1,
  },
  podcastIcon: {
    width: 50,
    height: 50,
  },
  microphoneIcon: {
    width: 50,
    height: 50,
  },
  stopButton: {
    borderRadius: 30,
    padding: 15,
  },
  stopIcon: {
    width: 50,
    height: 50,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 20,
    marginRight: 10,
  },
});

export default App;
