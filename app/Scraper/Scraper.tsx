import React, { useState } from "react";
import axios from "axios";

interface Video {
  title: string;
  videoId: string;
  duration: number;
}

export default function Scraper() {
  const [channelName, setChannelName] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get channel ID from channel name
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&type=channel&q=${encodeURIComponent(channelName)}&key=${apiKey}`;
      const searchResponse = await axios.get(searchUrl);
      const channelId = searchResponse.data.items[0].id.channelId;

      // Step 2: Get uploads playlist ID
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
      const channelResponse = await axios.get(channelUrl);
      const playlistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

      // Step 3: Get video IDs
      let videoIds: string[] = [];
      let nextPageToken = "";

      do {
        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${apiKey}`;
        const playlistResponse = await axios.get(playlistUrl);

        playlistResponse.data.items.forEach((item: any) => {
          videoIds.push(item.contentDetails.videoId);
        });

        nextPageToken = playlistResponse.data.nextPageToken;
      } while (nextPageToken);

      // Step 4: Get video durations
      let topShortestVideo: Video[] = [];

      for (let i = 0; i < videoIds.length; i += 50) {
        const videoIdChunk = videoIds.slice(i, i + 50).join(",");
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIdChunk}&key=${apiKey}`;
        const videoResponse = await axios.get(videoUrl);

        videoResponse.data.items.forEach((item: any) => {
          const duration = parseISO8601Duration(item.contentDetails.duration);
          topShortestVideo.push({
            title: item.snippet.title,
            videoId: item.id,
            duration,
          });
        });
      }

      topShortestVideo.sort((a, b) => a.duration - b.duration);
      setVideos(topShortestVideo.slice(0, 10));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to parse ISO 8601 duration
  const parseISO8601Duration = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold">YouTube Shortest Videos Scraper</h1>
      <input
        className="border p-2 rounded w-full mt-4"
        type="text"
        placeholder="Enter YouTube Channel Name"
        value={channelName}
        onChange={(e) => setChannelName(e.target.value)}
      />
      <input
        className="border p-2 rounded w-full mt-2"
        type="text"
        placeholder="Enter YouTube API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <button
        className="bg-blue-500 text-white p-2 rounded mt-4 w-full"
        onClick={fetchVideos}
        disabled={loading}
      >
        {loading ? "Loading..." : "Fetch Videos"}
      </button>

      {error && <p className="text-red-500 mt-4">Error: {error}</p>}

      <ul className="mt-4">
        {videos.map((video, index) => (
          <li key={index} className="border p-2 rounded mb-2">
            <h2 className="text-lg font-semibold">{video.title}</h2>
            <p>Duration: {video.duration} seconds</p>
            <a
              className="text-blue-500 underline"
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch Video
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
