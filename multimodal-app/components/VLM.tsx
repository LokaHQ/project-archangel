import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { CactusVLM } from 'cactus-react-native';
import RNFS from 'react-native-fs';

export default function VisionChat() {
  const [vlm, setVLM] = useState<CactusVLM | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    initializeVLM();
    return () => {
      vlm?.release();
    };
  }, []);

  const initializeVLM = async () => {
    try {
      const modelUrl = 'https://huggingface.co/Cactus-Compute/SmolVLM2-500m-Instruct-GGUF/resolve/main/SmolVLM2-500M-Video-Instruct-Q8_0.gguf';
      const mmprojUrl = 'https://huggingface.co/Cactus-Compute/SmolVLM2-500m-Instruct-GGUF/resolve/main/mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf';
      
      const [modelPath, mmprojPath] = await Promise.all([
        downloadFile(modelUrl, 'smolvlm-model.gguf'),
        downloadFile(mmprojUrl, 'smolvlm-mmproj.gguf'),
      ]);

      const { vlm: model, error } = await CactusVLM.init({
        model: modelPath,
        mmproj: mmprojPath,
        n_ctx: 2048,
      });

      if (error) throw error;
      setVLM(model);
    } catch (error) {
      console.error('Failed to initialize VLM:', error);
      Alert.alert('Error', 'Failed to initialize vision model');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = async (url: string, filename: string): Promise<string> => {
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
    
    if (await RNFS.exists(path)) return path;
    
    await RNFS.downloadFile({ fromUrl: url, toFile: path }).promise;
    return path;
  };

  const pickImage = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      },
      (response: {
        assets?: Array<{
          uri?: string;
          [key: string]: any;
        }>;
        [key: string]: any;
      }) => {
        if (response.assets && response.assets[0]) {
          setImagePath(response.assets[0].uri!);
          setResponse('');
        }
      }
    );
  };

  const analyzeImage = async () => {
    if (!vlm || !imagePath) return;

    setIsAnalyzing(true);
    try {
      const messages = [{ role: 'user', content: 'Describe this image in detail' }];
      
      let analysisResponse = '';
      const result = await vlm.completion(messages, {
        images: [imagePath],
        n_predict: 300,
        temperature: 0.3,
      }, (token) => {
        analysisResponse += token.token;
        setResponse(analysisResponse);
      });

      setResponse(analysisResponse || result.text);
    } catch (error) {
      console.error('Analysis failed:', error);
      Alert.alert('Error', 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading vision model...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Vision Chat
      </Text>
      
      {imagePath && (
        <Image
          source={{ uri: imagePath }}
          style={{
            width: '100%',
            height: 200,
            borderRadius: 8,
            marginBottom: 16,
          }}
          resizeMode="contain"
        />
      )}
      
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <TouchableOpacity
          onPress={pickImage}
          style={{
            backgroundColor: '#007AFF',
            padding: 12,
            borderRadius: 8,
            marginRight: 8,
            flex: 1,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Pick Image
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={analyzeImage}
          disabled={!imagePath || isAnalyzing}
          style={{
            backgroundColor: !imagePath || isAnalyzing ? '#cccccc' : '#34C759',
            padding: 12,
            borderRadius: 8,
            flex: 1,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={{
        flex: 1,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        padding: 16,
      }}>
        <Text style={{ fontSize: 16, lineHeight: 24 }}>
          {response || 'Select an image and tap Analyze to get started'}
        </Text>
      </View>
    </View>
  );
}