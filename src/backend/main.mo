import Outcall "http-outcalls/outcall";
import Text "mo:core/Text";
import Time "mo:core/Time";
import List "mo:core/List";
import Map "mo:core/Map";

actor self {
  public type ChatMessage = {
    role : Text;
    content : Text;
    timestamp : Int;
  };

  module ChatMessage {
    public func new(role : Text, content : Text) : ChatMessage {
      {
        role;
        content;
        timestamp = Time.now();
      };
    };
  };

  type SessionHistory = List.List<ChatMessage>;
  let sessionMap = Map.empty<Text, SessionHistory>();

  let GEMINI_API_KEY = "GEMINI_API_KEY";

  let SYSTEM_PROMPT = "You are a highly knowledgeable global pharmacy counselling AI assistant with comprehensive knowledge of all medicines worldwide including WHO essential medicines, medicines from Asia, Africa, Latin America, Europe, Middle East, and North America, traditional herbal medicines, drug interactions, dosing, side effects, pregnancy safety categories, and pediatric dosing. Respond clearly and accurately in the user language. Always remind users to consult a licensed healthcare provider for personal medical decisions.";

  func escapeJson(text : Text) : Text {
    var result = "";
    for (c in text.chars()) {
      let code = c.toNat32();
      if (code == 34) {
        result #= "\\\"";
      } else if (code == 92) {
        result #= "\\\\";
      } else if (c == '\n') {
        result #= "\\n";
      } else if (code == 13) {
        result #= "\\r";
      } else if (code == 9) {
        result #= "\\t";
      } else {
        result #= Text.fromChar(c);
      };
    };
    result;
  };

  func extractGeminiText(responseJson : Text) : Text {
    let marker = "\"text\":\"";
    let parts = responseJson.split(#text marker);
    switch (parts.next()) {
      case (null) { "I received an unexpected response. Please try again." };
      case (?_before) {
        switch (parts.next()) {
          case (null) { "I received an unexpected response. Please try again." };
          case (?afterMarker) {
            var result = "";
            var escaped = false;
            var done = false;
            for (c in afterMarker.chars()) {
              if (done) {
              } else if (escaped) {
                let code = c.toNat32();
                if (c == 'n') { result #= "\n"; }
                else if (c == 't') { result #= "\t"; }
                else if (code == 34) { result #= "\""; }
                else if (code == 92) { result #= "\\"; }
                else { result #= Text.fromChar(c); };
                escaped := false;
              } else if (c.toNat32() == 92) {
                escaped := true;
              } else if (c.toNat32() == 34) {
                done := true;
              } else {
                result #= Text.fromChar(c);
              };
            };
            if (result.size() == 0) {
              "I could not generate a response. Please try again.";
            } else {
              result;
            };
          };
        };
      };
    };
  };

  func buildChatBody(contextHistory : [ChatMessage], userMessage : Text) : Text {
    var contentsJson = "[";
    var first = true;

    for (msg in contextHistory.vals()) {
      let role = if (msg.role == "assistant") "model" else "user";
      if (not first) { contentsJson #= ","; };
      contentsJson #= "{\"role\":\"" # role # "\",\"parts\":[{\"text\":\"" # escapeJson(msg.content) # "\"}]}";
      first := false;
    };

    if (not first) { contentsJson #= ","; };
    contentsJson #= "{\"role\":\"user\",\"parts\":[{\"text\":\"" # escapeJson(userMessage) # "\"}]}";
    contentsJson #= "]";

    "{\"system_instruction\":{\"parts\":[{\"text\":\"" # escapeJson(SYSTEM_PROMPT) # "\"}]},\"contents\":" # contentsJson # ",\"generationConfig\":{\"temperature\":0.7,\"maxOutputTokens\":1024}}";
  };

  func buildSearchBody(searchQuery : Text) : Text {
    let prompt = "Provide structured pharmaceutical information about: " # searchQuery # ". Include these sections: Drug Class, Generic Name, Common Brand Names by region, Indications, Dosage Forms, Typical Adult Dosage, Key Warnings, Common Side Effects, Major Drug Interactions, Global Availability.";
    "{\"system_instruction\":{\"parts\":[{\"text\":\"" # escapeJson(SYSTEM_PROMPT) # "\"}]},\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":\"" # escapeJson(prompt) # "\"}]}],\"generationConfig\":{\"temperature\":0.3,\"maxOutputTokens\":1200}}";
  };

  public query func transform(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    { input.response with headers = [] };
  };

  public shared func sendMessage(sessionId : Text, message : Text) : async Text {
    let userMsg = ChatMessage.new("user", message);

    let sessionHistory = switch (sessionMap.get(sessionId)) {
      case (null) {
        let h = List.empty<ChatMessage>();
        h.add(userMsg);
        h;
      };
      case (?h) {
        h.add(userMsg);
        h;
      };
    };

    let total = sessionHistory.size();
    let ctxStart : Int = if (total > 7) total - 7 else 0;
    let ctxEnd : Int = if (total > 1) total - 1 else 0;
    let contextHistory : [ChatMessage] = if (ctxEnd > ctxStart) {
      sessionHistory.sliceToArray(ctxStart, ctxEnd);
    } else {
      [];
    };

    let body = buildChatBody(contextHistory, message);
    let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" # GEMINI_API_KEY;
    let headers : [Outcall.Header] = [{ name = "Content-Type"; value = "application/json" }];

    let responseText = try {
      let raw = await Outcall.httpPostRequest(url, headers, body, self.transform);
      extractGeminiText(raw);
    } catch (_) {
      "I am currently unable to process your request. Please try again in a moment.";
    };

    let assistantMsg = ChatMessage.new("assistant", responseText);
    sessionHistory.add(assistantMsg);
    sessionMap.add(sessionId, sessionHistory);

    responseText;
  };

  public shared func searchMedicine(searchQuery : Text) : async Text {
    let body = buildSearchBody(searchQuery);
    let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" # GEMINI_API_KEY;
    let headers : [Outcall.Header] = [{ name = "Content-Type"; value = "application/json" }];

    try {
      let raw = await Outcall.httpPostRequest(url, headers, body, self.transform);
      let result = extractGeminiText(raw);
      if (result.size() == 0) {
        "No information found. Please try a different medicine name or spelling.";
      } else {
        result;
      };
    } catch (_) {
      "Unable to look up medicine information at this time. Please try again.";
    };
  };

  public query func getChatHistory(sessionId : Text) : async [ChatMessage] {
    switch (sessionMap.get(sessionId)) {
      case (null) { [] };
      case (?h) { h.reverseValues().toArray() };
    };
  };

  public shared func clearHistory(sessionId : Text) : async () {
    sessionMap.remove(sessionId);
  };
};
