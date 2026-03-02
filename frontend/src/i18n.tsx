import { createContext, useContext, useState, type ReactNode } from 'react'

export type Locale = 'en' | 'ja'

const translations = {
  en: {
    // App - landing
    'app.subtitle': 'Quantitative text analysis & visualization',
    'app.supportedFormats': 'Supports .txt, .md, .xml, .pdf \u00b7 English & Japanese',
    'app.trySample': 'or try a sample',
    // App - loading
    'app.analysing': 'Analysing your document...',
    // App - dashboard header
    'app.chars': 'chars',
    'app.sample': 'Sample',
    'app.newFile': 'Reset',
    // App - tab labels
    'tab.frequencies': 'Frequencies',
    'tab.kwic': 'KWIC',
    'tab.reader': 'Reader',
    'tab.cloud': 'Word Cloud',
    'tab.trends': 'Trends',
    'tab.cooccurrence': 'Co-occurrence',
    'tab.correspondence': 'Correspondence',
    'tab.cluster': 'Clustering',
    'tab.topics': 'Topics',
    'tab.word2vec': 'Word2Vec',
    'tab.coding': 'Coding',
    // UploadZone
    'upload.drop': 'Drop your file here',
    'upload.dragOrClick': 'Drag & drop or click to select',
    'upload.formats': 'txt, md, xml, pdf',
    // FrequencyTable
    'freq.title': 'Frequencies',
    'freq.count': 'Count',
    'freq.tfidf': 'TF-IDF',
    'freq.csv': 'CSV',
    'freq.saveAs': 'Save as CSV',
    'freq.filename': 'File name',
    'freq.save': 'Save',
    'freq.word': 'Word',
    'freq.pos': 'POS',
    'freq.freq': 'Freq',
    'freq.removeFromTrends': 'Remove from trends',
    'freq.addToTrends': 'Add to trends',
    // KwicPanel
    'kwic.concordance': 'KWIC Concordance',
    'kwic.selectWord': 'Select a word to view concordance',
    'kwic.title': 'KWIC',
    'kwic.hits': 'hits',
    'kwic.downloadCsv': 'Download KWIC as CSV',
    'kwic.csv': 'CSV',
    'kwic.saveAs': 'Save KWIC as CSV',
    'kwic.filename': 'File name',
    'kwic.save': 'Save',
    'kwic.noMatches': 'No matches found',
    // ReaderPanel
    'reader.title': 'Reader',
    // WordCloudPanel
    'cloud.noData': 'No data',
    // TrendsPanel
    'trends.trackPrompt': 'Track words or concepts to see trends',
    'trends.loading': 'Loading...',
    // CorrespondencePanel
    'correspondence.words': 'words',
    'correspondence.segments': 'segments',
    'correspondence.noData': 'Not enough data',
    'correspondence.dim1': 'Dim 1',
    'correspondence.dim2': 'Dim 2',
    // TopicPanel
    'topics.topics': 'Topics',
    'topics.all': 'All',
    'topics.noData': 'Not enough data for topic modeling',
    'topics.weight': 'weight',
    'topics.scatterDesc': 'Sentences by dominant topic probability (x = position, y = confidence)',
    'topics.sentence': 'Sentence',
    'topics.confidence': 'Confidence',
    'topics.method': 'Method',
    'topics.lda': 'LDA',
    'topics.nmf': 'NMF',
    'topics.lda.desc': 'Latent Dirichlet Allocation \u2014 a probabilistic model that assumes each document is a mixture of topics. Works well with longer texts and bag-of-words representation.',
    'topics.nmf.desc': 'Non-negative Matrix Factorization \u2014 decomposes the TF-IDF matrix into topic components. Often produces more coherent and interpretable topics than LDA.',
    'topics.exportSelect': 'Charts to export',
    'topics.scatter': 'Scatter',
    'topics.selectAll': 'All',
    // Word2VecPanel
    'w2v.words': 'words',
    'w2v.selected': 'selected',
    'w2v.similar': 'similar',
    'w2v.noData': 'Not enough data',
    'w2v.similarWords': 'Similar Words',
    'w2v.noSimilar': 'No similar words found',
    'w2v.clickToSee': 'Click a word to see similar words',
    // CodingPanel
    'coding.conceptName': 'Concept name',
    'coding.addRule': 'Add Rule',
    'coding.running': 'Running...',
    'coding.runAll': 'Run All',
    'coding.noRules': 'No coding rules defined',
    'coding.instructions': 'Define a concept name and a Boolean expression using',
    'coding.removeFromTrends': 'Remove from Trends',
    'coding.addToTrends': 'Add to Trends',
    // Compare / Document bar
    'tab.compare': 'Compare',
    'compare.selectDocs': 'Select documents to compare',
    'compare.all': 'All words',
    'compare.shared': 'Shared only',
    'compare.unique': 'Unique only',
    'compare.diff': 'Diff',
    'compare.noDocs': 'Load two or more documents to compare',
    'compare.csv': 'CSV',
    'docbar.add': 'Add',
    'docbar.upload': 'Upload file',
    'docbar.remove': 'Remove',
    // CooccurrencePanel color modes
    // Sample submenu
    'sample.search': 'Search...',
    'sample.records': 'records',
    // CooccurrencePanel color modes
    'cooccurrence.colorMode': 'Color',
    'cooccurrence.default': 'Default',
    'cooccurrence.default.desc': 'Uniform color — no metric applied',
    'cooccurrence.degree': 'Degree',
    'cooccurrence.degree.desc': 'Degree centrality — number of direct connections. High-degree words co-occur with many other words.',
    'cooccurrence.betweenness': 'Betweenness',
    'cooccurrence.betweenness.desc': 'Betweenness centrality — how often a word lies on the shortest path between other words. High values indicate bridge words connecting different topics.',
    'cooccurrence.closeness': 'Closeness',
    'cooccurrence.closeness.desc': 'Closeness centrality — average distance to all other words. High values indicate words that are closely related to the entire network.',
    'cooccurrence.community': 'Community',
    'cooccurrence.community.desc': 'Community detection — groups of words that frequently co-occur together, forming topic clusters.',
    'cooccurrence.low': 'Low',
    'cooccurrence.high': 'High',
    // Help
    'help.title': 'How to Use TextScope',
    'help.close': 'Close',
    'help.gettingStarted': 'Getting Started',
    'help.gettingStartedDesc': 'Upload a text file (.txt, .md, .xml, .pdf, .csv) or select a sample dataset to begin analysis. You can load multiple documents and switch between them.',
    'help.frequencies': 'Frequencies',
    'help.frequenciesDesc': 'Word frequency table with POS tagging. Toggle between raw count and TF-IDF scores. Click a word to highlight it across all panels. Track words to monitor in Trends.',
    'help.kwic': 'KWIC',
    'help.kwicDesc': 'Key Word In Context concordance. Shows each occurrence of the selected word with its surrounding context, making it easy to see usage patterns.',
    'help.reader': 'Reader',
    'help.readerDesc': 'Full text view with the selected word highlighted. Useful for reading the document in context.',
    'help.cloud': 'Word Cloud',
    'help.cloudDesc': 'Visual word cloud where size reflects frequency. Click any word to select it.',
    'help.trends': 'Trends',
    'help.trendsDesc': 'Line chart showing tracked word frequencies across document segments. Add words from the Frequencies panel or coded concepts from the Coding panel.',
    'help.cooccurrence': 'Co-occurrence',
    'help.cooccurrenceDesc': 'Network graph of words that appear together. Color modes show centrality metrics (degree, betweenness, closeness) or community clusters.',
    'help.correspondence': 'Correspondence',
    'help.correspondenceDesc': 'Correspondence analysis plots words and document segments in 2D space. Words/segments that co-occur are placed closer together.',
    'help.cluster': 'Clustering',
    'help.clusterDesc': 'Hierarchical clustering dendrogram grouping similar words based on co-occurrence patterns.',
    'help.topics': 'Topics',
    'help.topicsDesc': 'Topic modeling (LDA, NMF). Discovers latent topics and shows the top words for each topic, plus a scatter plot of sentence-topic assignments.',
    'help.word2vec': 'Word2Vec',
    'help.word2vecDesc': 'Word embedding visualization. Click a word to find semantically similar words. The 2D plot shows word relationships learned from the document.',
    'help.coding': 'Coding',
    'help.codingDesc': 'Define Boolean search rules (AND, OR, NOT) to create custom concepts. Run them to see match counts per segment and optionally track in Trends.',
    'help.compare': 'Compare',
    'help.compareDesc': 'Load two or more documents and compare their word frequencies side by side. Filter by shared, unique, or diff words.',
    // Intro splash
    'intro.tagline1': 'See the patterns',
    'intro.tagline2': 'hidden in your text',
    'intro.feature1': 'Analyze',
    'intro.feature2': 'Visualize',
    'intro.feature3': 'Discover',
    'intro.skip': 'Skip',
    // Export image
    'export.save': 'Save',
    'export.filename': 'File name',
    'export.format': 'Format',
  },
  ja: {
    // App - landing
    'app.subtitle': '\u5b9a\u91cf\u30c6\u30ad\u30b9\u30c8\u5206\u6790 & \u53ef\u8996\u5316',
    'app.supportedFormats': '.txt, .md, .xml, .pdf \u5bfe\u5fdc \u00b7 \u82f1\u8a9e & \u65e5\u672c\u8a9e',
    'app.trySample': '\u307e\u305f\u306f\u30b5\u30f3\u30d7\u30eb\u3092\u8a66\u3059',
    // App - loading
    'app.analysing': '\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u3092\u5206\u6790\u4e2d...',
    // App - dashboard header
    'app.chars': '\u6587\u5b57',
    'app.sample': '\u30b5\u30f3\u30d7\u30eb',
    'app.newFile': '\u30ea\u30bb\u30c3\u30c8',
    // App - tab labels
    'tab.frequencies': '\u983b\u5ea6',
    'tab.kwic': 'KWIC',
    'tab.reader': '\u30ea\u30fc\u30c0\u30fc',
    'tab.cloud': '\u30ef\u30fc\u30c9\u30af\u30e9\u30a6\u30c9',
    'tab.trends': '\u30c8\u30ec\u30f3\u30c9',
    'tab.cooccurrence': '\u5171\u8d77',
    'tab.correspondence': '\u30b3\u30ec\u30b9\u30dd\u30f3\u30c7\u30f3\u30b9',
    'tab.cluster': '\u30af\u30e9\u30b9\u30bf\u30ea\u30f3\u30b0',
    'tab.topics': '\u30c8\u30d4\u30c3\u30af',
    'tab.word2vec': 'Word2Vec',
    'tab.coding': '\u30b3\u30fc\u30c7\u30a3\u30f3\u30b0',
    // UploadZone
    'upload.drop': '\u3053\u3053\u306b\u30d5\u30a1\u30a4\u30eb\u3092\u30c9\u30ed\u30c3\u30d7',
    'upload.dragOrClick': '\u30c9\u30e9\u30c3\u30b0\uff06\u30c9\u30ed\u30c3\u30d7\u307e\u305f\u306f\u30af\u30ea\u30c3\u30af\u3067\u9078\u629e',
    'upload.formats': 'txt, md, xml, pdf',
    // FrequencyTable
    'freq.title': '\u983b\u5ea6',
    'freq.count': '\u30ab\u30a6\u30f3\u30c8',
    'freq.tfidf': 'TF-IDF',
    'freq.csv': 'CSV',
    'freq.saveAs': 'CSV\u3068\u3057\u3066\u4fdd\u5b58',
    'freq.filename': '\u30d5\u30a1\u30a4\u30eb\u540d',
    'freq.save': '\u4fdd\u5b58',
    'freq.word': '\u5358\u8a9e',
    'freq.pos': '\u54c1\u8a5e',
    'freq.freq': '\u983b\u5ea6',
    'freq.removeFromTrends': '\u30c8\u30ec\u30f3\u30c9\u304b\u3089\u524a\u9664',
    'freq.addToTrends': '\u30c8\u30ec\u30f3\u30c9\u306b\u8ffd\u52a0',
    // KwicPanel
    'kwic.concordance': 'KWIC \u30b3\u30f3\u30b3\u30fc\u30c0\u30f3\u30b9',
    'kwic.selectWord': '\u5358\u8a9e\u3092\u9078\u629e\u3057\u3066\u30b3\u30f3\u30b3\u30fc\u30c0\u30f3\u30b9\u3092\u8868\u793a',
    'kwic.title': 'KWIC',
    'kwic.hits': '\u4ef6',
    'kwic.downloadCsv': 'KWIC\u3092CSV\u3067\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9',
    'kwic.csv': 'CSV',
    'kwic.saveAs': 'KWIC\u3092CSV\u3067\u4fdd\u5b58',
    'kwic.filename': '\u30d5\u30a1\u30a4\u30eb\u540d',
    'kwic.save': '\u4fdd\u5b58',
    'kwic.noMatches': '\u4e00\u81f4\u306a\u3057',
    // ReaderPanel
    'reader.title': '\u30ea\u30fc\u30c0\u30fc',
    // WordCloudPanel
    'cloud.noData': '\u30c7\u30fc\u30bf\u306a\u3057',
    // TrendsPanel
    'trends.trackPrompt': '\u5358\u8a9e\u307e\u305f\u306f\u30b3\u30f3\u30bb\u30d7\u30c8\u3092\u8ffd\u8de1\u3057\u3066\u30c8\u30ec\u30f3\u30c9\u3092\u8868\u793a',
    'trends.loading': '\u8aad\u307f\u8fbc\u307f\u4e2d...',
    // CorrespondencePanel
    'correspondence.words': '\u5358\u8a9e',
    'correspondence.segments': '\u30bb\u30b0\u30e1\u30f3\u30c8',
    'correspondence.noData': '\u30c7\u30fc\u30bf\u4e0d\u8db3',
    'correspondence.dim1': '\u6b21\u5143 1',
    'correspondence.dim2': '\u6b21\u5143 2',
    // TopicPanel
    'topics.topics': '\u30c8\u30d4\u30c3\u30af\u6570',
    'topics.all': '\u5168\u3066',
    'topics.noData': '\u30c8\u30d4\u30c3\u30af\u30e2\u30c7\u30ea\u30f3\u30b0\u306b\u5341\u5206\u306a\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093',
    'topics.weight': '\u91cd\u307f',
    'topics.scatterDesc': '\u6587\u3054\u3068\u306e\u4e3b\u8981\u30c8\u30d4\u30c3\u30af\u78ba\u4fe1\u5ea6 (x = \u4f4d\u7f6e, y = \u78ba\u4fe1\u5ea6)',
    'topics.sentence': '\u6587',
    'topics.confidence': '\u78ba\u4fe1\u5ea6',
    'topics.method': '\u624b\u6cd5',
    'topics.lda': 'LDA',
    'topics.nmf': 'NMF',
    'topics.lda.desc': '\u6f5c\u5728\u7684\u30c7\u30a3\u30ea\u30af\u30ec\u914d\u5206\u6cd5 \u2014 \u5404\u6587\u66f8\u304c\u30c8\u30d4\u30c3\u30af\u306e\u6df7\u5408\u3067\u3042\u308b\u3068\u4eee\u5b9a\u3059\u308b\u78ba\u7387\u30e2\u30c7\u30eb\u3002\u9577\u3044\u30c6\u30ad\u30b9\u30c8\u3084\u5358\u8a9e\u983b\u5ea6\u30d9\u30fc\u30b9\u306e\u5206\u6790\u306b\u9069\u3057\u3066\u3044\u307e\u3059\u3002',
    'topics.nmf.desc': '\u975e\u8ca0\u5024\u884c\u5217\u56e0\u5b50\u5206\u89e3 \u2014 TF-IDF\u884c\u5217\u3092\u30c8\u30d4\u30c3\u30af\u6210\u5206\u306b\u5206\u89e3\u3057\u307e\u3059\u3002LDA\u3088\u308a\u4e00\u8cab\u6027\u306e\u3042\u308b\u89e3\u91c8\u3057\u3084\u3059\u3044\u30c8\u30d4\u30c3\u30af\u3092\u751f\u6210\u3059\u308b\u3053\u3068\u304c\u591a\u3044\u3067\u3059\u3002',
    'topics.exportSelect': '\u51fa\u529b\u3059\u308b\u30c1\u30e3\u30fc\u30c8',
    'topics.scatter': '\u6563\u5e03\u56f3',
    'topics.selectAll': '\u5168\u3066',
    // Word2VecPanel
    'w2v.words': '\u5358\u8a9e',
    'w2v.selected': '\u9078\u629e\u4e2d',
    'w2v.similar': '\u985e\u4f3c',
    'w2v.noData': '\u30c7\u30fc\u30bf\u4e0d\u8db3',
    'w2v.similarWords': '\u985e\u4f3c\u5358\u8a9e',
    'w2v.noSimilar': '\u985e\u4f3c\u5358\u8a9e\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093',
    'w2v.clickToSee': '\u5358\u8a9e\u3092\u30af\u30ea\u30c3\u30af\u3057\u3066\u985e\u4f3c\u5358\u8a9e\u3092\u8868\u793a',
    // CodingPanel
    'coding.conceptName': '\u30b3\u30f3\u30bb\u30d7\u30c8\u540d',
    'coding.addRule': '\u30eb\u30fc\u30eb\u8ffd\u52a0',
    'coding.running': '\u5b9f\u884c\u4e2d...',
    'coding.runAll': '\u5168\u3066\u5b9f\u884c',
    'coding.noRules': '\u30b3\u30fc\u30c7\u30a3\u30f3\u30b0\u30eb\u30fc\u30eb\u672a\u5b9a\u7fa9',
    'coding.instructions': '\u30b3\u30f3\u30bb\u30d7\u30c8\u540d\u3068\u30d6\u30fc\u30eb\u5f0f\u3092\u5b9a\u7fa9\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u4f7f\u7528\u53ef\u80fd:',
    'coding.removeFromTrends': '\u30c8\u30ec\u30f3\u30c9\u304b\u3089\u524a\u9664',
    'coding.addToTrends': '\u30c8\u30ec\u30f3\u30c9\u306b\u8ffd\u52a0',
    // Compare / Document bar
    'tab.compare': '\u6bd4\u8f03',
    'compare.selectDocs': '\u6bd4\u8f03\u3059\u308b\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u3092\u9078\u629e',
    'compare.all': '\u5168\u5358\u8a9e',
    'compare.shared': '\u5171\u901a\u306e\u307f',
    'compare.unique': '\u56fa\u6709\u306e\u307f',
    'compare.diff': '\u5dee\u5206',
    'compare.noDocs': '2\u3064\u4ee5\u4e0a\u306e\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u3092\u8aad\u307f\u8fbc\u3093\u3067\u6bd4\u8f03',
    'compare.csv': 'CSV',
    'docbar.add': '\u8ffd\u52a0',
    'docbar.upload': '\u30a2\u30c3\u30d7\u30ed\u30fc\u30c9',
    'docbar.remove': '\u524a\u9664',
    // Sample submenu
    'sample.search': '\u691c\u7d22...',
    'sample.records': '\u4ef6',
    // CooccurrencePanel color modes
    'cooccurrence.colorMode': '\u8272\u5206\u3051',
    'cooccurrence.default': '\u30c7\u30d5\u30a9\u30eb\u30c8',
    'cooccurrence.default.desc': '\u5747\u4e00\u8272 \u2014 \u7279\u5fb4\u91cf\u306a\u3057',
    'cooccurrence.degree': '\u6b21\u6570\u4e2d\u5fc3\u6027',
    'cooccurrence.degree.desc': '\u6b21\u6570\u4e2d\u5fc3\u6027 \u2014 \u76f4\u63a5\u3064\u306a\u304c\u308b\u5358\u8a9e\u306e\u6570\u3002\u5024\u304c\u9ad8\u3044\u5358\u8a9e\u306f\u591a\u304f\u306e\u5358\u8a9e\u3068\u5171\u8d77\u3057\u3066\u3044\u307e\u3059\u3002',
    'cooccurrence.betweenness': '\u5a92\u4ecb\u4e2d\u5fc3\u6027',
    'cooccurrence.betweenness.desc': '\u5a92\u4ecb\u4e2d\u5fc3\u6027 \u2014 \u4ed6\u306e\u5358\u8a9e\u9593\u306e\u6700\u77ed\u7d4c\u8def\u4e0a\u306b\u3042\u308b\u983b\u5ea6\u3002\u5024\u304c\u9ad8\u3044\u5358\u8a9e\u306f\u7570\u306a\u308b\u30c8\u30d4\u30c3\u30af\u3092\u3064\u306a\u3050\u6a4b\u6e21\u3057\u5f79\u3067\u3059\u3002',
    'cooccurrence.closeness': '\u8fd1\u63a5\u4e2d\u5fc3\u6027',
    'cooccurrence.closeness.desc': '\u8fd1\u63a5\u4e2d\u5fc3\u6027 \u2014 \u4ed6\u306e\u5168\u5358\u8a9e\u3078\u306e\u5e73\u5747\u8ddd\u96e2\u3002\u5024\u304c\u9ad8\u3044\u5358\u8a9e\u306f\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u5168\u4f53\u3068\u5bc6\u63a5\u306b\u95a2\u9023\u3057\u3066\u3044\u307e\u3059\u3002',
    'cooccurrence.community': '\u30b3\u30df\u30e5\u30cb\u30c6\u30a3',
    'cooccurrence.community.desc': '\u30b3\u30df\u30e5\u30cb\u30c6\u30a3\u691c\u51fa \u2014 \u983b\u7e41\u306b\u5171\u8d77\u3059\u308b\u5358\u8a9e\u306e\u30b0\u30eb\u30fc\u30d7\u3067\u3001\u30c8\u30d4\u30c3\u30af\u30af\u30e9\u30b9\u30bf\u30fc\u3092\u5f62\u6210\u3057\u307e\u3059\u3002',
    'cooccurrence.low': '\u4f4e',
    'cooccurrence.high': '\u9ad8',
    // Help
    'help.title': 'TextScope \u306e\u4f7f\u3044\u65b9',
    'help.close': '\u9589\u3058\u308b',
    'help.gettingStarted': '\u306f\u3058\u3081\u306b',
    'help.gettingStartedDesc': '\u30c6\u30ad\u30b9\u30c8\u30d5\u30a1\u30a4\u30eb\uff08.txt, .md, .xml, .pdf, .csv\uff09\u3092\u30a2\u30c3\u30d7\u30ed\u30fc\u30c9\u3059\u308b\u304b\u3001\u30b5\u30f3\u30d7\u30eb\u30c7\u30fc\u30bf\u3092\u9078\u3093\u3067\u5206\u6790\u3092\u958b\u59cb\u3057\u307e\u3059\u3002\u8907\u6570\u306e\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u3092\u8aad\u307f\u8fbc\u3093\u3067\u5207\u308a\u66ff\u3048\u308b\u3053\u3068\u3082\u3067\u304d\u307e\u3059\u3002',
    'help.frequencies': '\u983b\u5ea6',
    'help.frequenciesDesc': '\u54c1\u8a5e\u4ed8\u304d\u5358\u8a9e\u983b\u5ea6\u8868\u3002\u30ab\u30a6\u30f3\u30c8\u3068TF-IDF\u3092\u5207\u308a\u66ff\u3048\u53ef\u80fd\u3002\u5358\u8a9e\u3092\u30af\u30ea\u30c3\u30af\u3059\u308b\u3068\u5404\u30d1\u30cd\u30eb\u3067\u30cf\u30a4\u30e9\u30a4\u30c8\u3055\u308c\u307e\u3059\u3002\u30c8\u30ec\u30f3\u30c9\u8ffd\u8de1\u3082\u53ef\u80fd\u3002',
    'help.kwic': 'KWIC',
    'help.kwicDesc': 'Key Word In Context\uff08\u6587\u8108\u4ed8\u304d\u30ad\u30fc\u30ef\u30fc\u30c9\uff09\u3002\u9078\u629e\u3057\u305f\u5358\u8a9e\u306e\u524d\u5f8c\u306e\u6587\u8108\u3092\u4e00\u89a7\u8868\u793a\u3057\u3001\u7528\u6cd5\u30d1\u30bf\u30fc\u30f3\u3092\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002',
    'help.reader': '\u30ea\u30fc\u30c0\u30fc',
    'help.readerDesc': '\u30c6\u30ad\u30b9\u30c8\u5168\u6587\u8868\u793a\u3002\u9078\u629e\u3057\u305f\u5358\u8a9e\u304c\u30cf\u30a4\u30e9\u30a4\u30c8\u3055\u308c\u3001\u6587\u8108\u306e\u4e2d\u3067\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002',
    'help.cloud': '\u30ef\u30fc\u30c9\u30af\u30e9\u30a6\u30c9',
    'help.cloudDesc': '\u983b\u5ea6\u306b\u5fdc\u3058\u305f\u30b5\u30a4\u30ba\u3067\u5358\u8a9e\u3092\u8996\u899a\u5316\u3002\u5358\u8a9e\u30af\u30ea\u30c3\u30af\u3067\u9078\u629e\u53ef\u80fd\u3002',
    'help.trends': '\u30c8\u30ec\u30f3\u30c9',
    'help.trendsDesc': '\u8ffd\u8de1\u4e2d\u306e\u5358\u8a9e\u306e\u983b\u5ea6\u63a8\u79fb\u3092\u6298\u308c\u7dda\u30b0\u30e9\u30d5\u3067\u8868\u793a\u3002\u983b\u5ea6\u30d1\u30cd\u30eb\u3084\u30b3\u30fc\u30c7\u30a3\u30f3\u30b0\u304b\u3089\u5358\u8a9e\u3092\u8ffd\u52a0\u3067\u304d\u307e\u3059\u3002',
    'help.cooccurrence': '\u5171\u8d77',
    'help.cooccurrenceDesc': '\u5171\u8d77\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u30b0\u30e9\u30d5\u3002\u8272\u5206\u3051\u30e2\u30fc\u30c9\u3067\u4e2d\u5fc3\u6027\u6307\u6a19\uff08\u6b21\u6570\u30fb\u5a92\u4ecb\u30fb\u8fd1\u63a5\uff09\u3084\u30b3\u30df\u30e5\u30cb\u30c6\u30a3\u3092\u53ef\u8996\u5316\u3002',
    'help.correspondence': '\u30b3\u30ec\u30b9\u30dd\u30f3\u30c7\u30f3\u30b9',
    'help.correspondenceDesc': '\u30b3\u30ec\u30b9\u30dd\u30f3\u30c7\u30f3\u30b9\u5206\u6790\u3067\u5358\u8a9e\u3068\u30bb\u30b0\u30e1\u30f3\u30c8\u30922D\u7a7a\u9593\u306b\u30d7\u30ed\u30c3\u30c8\u3002\u5171\u8d77\u3059\u308b\u3082\u306e\u306f\u8fd1\u304f\u306b\u914d\u7f6e\u3055\u308c\u307e\u3059\u3002',
    'help.cluster': '\u30af\u30e9\u30b9\u30bf\u30ea\u30f3\u30b0',
    'help.clusterDesc': '\u5171\u8d77\u30d1\u30bf\u30fc\u30f3\u306b\u57fa\u3065\u304f\u968e\u5c64\u7684\u30af\u30e9\u30b9\u30bf\u30ea\u30f3\u30b0\u3002\u30c7\u30f3\u30c9\u30ed\u30b0\u30e9\u30e0\u3067\u985e\u4f3c\u5358\u8a9e\u3092\u30b0\u30eb\u30fc\u30d4\u30f3\u30b0\u3002',
    'help.topics': '\u30c8\u30d4\u30c3\u30af',
    'help.topicsDesc': '\u30c8\u30d4\u30c3\u30af\u30e2\u30c7\u30ea\u30f3\u30b0 (LDA, NMF)\u3002\u6f5c\u5728\u30c8\u30d4\u30c3\u30af\u3092\u767a\u898b\u3057\u3001\u5404\u30c8\u30d4\u30c3\u30af\u306e\u4e3b\u8981\u5358\u8a9e\u3068\u6587\u306e\u30c8\u30d4\u30c3\u30af\u5272\u308a\u5f53\u3066\u3092\u6563\u5e03\u56f3\u3067\u8868\u793a\u3002',
    'help.word2vec': 'Word2Vec',
    'help.word2vecDesc': '\u5358\u8a9e\u57cb\u3081\u8fbc\u307f\u306e\u53ef\u8996\u5316\u3002\u5358\u8a9e\u3092\u30af\u30ea\u30c3\u30af\u3057\u3066\u610f\u5473\u7684\u306b\u985e\u4f3c\u3057\u305f\u5358\u8a9e\u3092\u691c\u7d22\u30022D\u30d7\u30ed\u30c3\u30c8\u3067\u5358\u8a9e\u306e\u95a2\u4fc2\u6027\u3092\u8868\u793a\u3002',
    'help.coding': '\u30b3\u30fc\u30c7\u30a3\u30f3\u30b0',
    'help.codingDesc': '\u30d6\u30fc\u30eb\u691c\u7d22\u30eb\u30fc\u30eb\uff08AND, OR, NOT\uff09\u3067\u30ab\u30b9\u30bf\u30e0\u30b3\u30f3\u30bb\u30d7\u30c8\u3092\u5b9a\u7fa9\u3002\u30bb\u30b0\u30e1\u30f3\u30c8\u3054\u3068\u306e\u4e00\u81f4\u6570\u3092\u78ba\u8a8d\u3057\u3001\u30c8\u30ec\u30f3\u30c9\u3067\u8ffd\u8de1\u53ef\u80fd\u3002',
    'help.compare': '\u6bd4\u8f03',
    'help.compareDesc': '2\u3064\u4ee5\u4e0a\u306e\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u306e\u5358\u8a9e\u983b\u5ea6\u3092\u4e26\u3079\u3066\u6bd4\u8f03\u3002\u5171\u901a\u30fb\u56fa\u6709\u30fb\u5dee\u5206\u3067\u30d5\u30a3\u30eb\u30bf\u30ea\u30f3\u30b0\u53ef\u80fd\u3002',
    // Intro splash
    'intro.tagline1': '\u30c6\u30ad\u30b9\u30c8\u306b\u6f5c\u3080',
    'intro.tagline2': '\u30d1\u30bf\u30fc\u30f3\u3092\u898b\u3064\u3051\u308b',
    'intro.feature1': '\u5206\u6790',
    'intro.feature2': '\u53ef\u8996\u5316',
    'intro.feature3': '\u767a\u898b',
    'intro.skip': '\u30b9\u30ad\u30c3\u30d7',
    // Export image
    'export.save': '\u4fdd\u5b58',
    'export.filename': '\u30d5\u30a1\u30a4\u30eb\u540d',
    'export.format': '\u5f62\u5f0f',
  },
} as const

export type TranslationKey = keyof typeof translations.en

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')

  const t = (key: TranslationKey): string => translations[locale][key]

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
