import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { useQuery } from "@tanstack/react-query";
import { resolveUrl } from "@/utils/api";
import { Loader2, TrendingUp, Compass, Award, ShieldAlert, ArrowRight, Share2, Calendar, User, Clock, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PropagationNode extends d3.SimulationNodeDatum {
  id: string;
  userId: string;
  label: string;
  displayName: string;
  avatarUrl: string;
  isVerified?: boolean;
  role: "creator" | "repost" | "quote" | string;
  postId: string;
  createdAt: string;
  caption?: string;
  depth: number;
}

interface PropagationLink extends d3.SimulationLinkDatum<PropagationNode> {
  source: string | PropagationNode;
  target: string | PropagationNode;
  type: "repost" | "quote" | string;
  createdAt: string;
}

interface PropagationStats {
  postId: string;
  originalPostId: string;
  originalCreator: {
    userId: string;
    username: string;
    display_name: string;
    avatar_url: string;
    is_verified: boolean;
    hide_propagation_details: boolean;
  };
  nodes: PropagationNode[];
  links: PropagationLink[];
  analytics: {
    totalShares: number;
    repostsCount: number;
    quotesCount: number;
    spreadDepth: number;
    spreadSpeedMinutes: number;
    longestChain: string[];
    topAmplifiers: Array<{
      username: string;
      displayName: string;
      avatarUrl: string;
      downstreamCount: number;
    }>;
  };
}

export const PropagationGraph: React.FC<{ postId: string; onClose?: () => void }> = ({ postId, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<PropagationNode | null>(null);

  const { data, isLoading, error } = useQuery<PropagationStats>({
    queryKey: ["propagation-stats", postId],
    queryFn: async () => {
      const res = await fetch(resolveUrl(`/api/propagation/stats/${postId}`));
      if (!res.ok) throw new Error("Failed to load propagation statistics");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous elements

    const width = containerRef.current?.clientWidth || 600;
    const height = 450;

    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    // Create defs for clipping and patterns (images inside circles)
    const defs = svg.append("defs");

    // Add arrowhead markers for directed lines
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 26) // Position at circle boundary (radius ~20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#6b7280");

    // Add a marker for quote shares (e.g. green arrowhead)
    defs
      .append("marker")
      .attr("id", "arrowhead-quote")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 26)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#10b981");

    // Create a pattern for each node to hold the user's avatar
    data.nodes.forEach((node) => {
      const size = 44;
      const pattern = defs
        .append("pattern")
        .attr("id", `avatar-${node.id}`)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 1)
        .attr("height", 1)
        .attr("patternUnits", "objectBoundingBox");

      pattern
        .append("image")
        .attr("href", node.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${node.userId}`)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", size)
        .attr("height", size)
        .attr("preserveAspectRatio", "xMidYMid slice");
    });

    // Deep copy nodes and links for simulation
    const nodesCopy = data.nodes.map((d) => ({ ...d }));
    const linksCopy = data.links.map((d) => ({
      ...d,
      source: typeof d.source === "string" ? d.source : (d.source as any).id,
      target: typeof d.target === "string" ? d.target : (d.target as any).id,
    }));

    // Find original creator to set as selected node initially
    const rootNode = nodesCopy.find((n) => n.role === "creator");
    if (rootNode) setSelectedNode(rootNode as any);

    // Setup force simulation
    const simulation = d3
      .forceSimulation<PropagationNode>(nodesCopy as any)
      .force(
        "link",
        d3
          .forceLink<PropagationNode, PropagationLink>(linksCopy as any)
          .id((d) => d.id)
          .distance(110)
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Draw link edges
    const link = svg
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(linksCopy)
      .enter()
      .append("line")
      .attr("stroke", (d) => (d.type === "quote" ? "#10b981" : "#4b5563"))
      .attr("stroke-width", (d) => (d.type === "quote" ? 2 : 1.5))
      .attr("stroke-dasharray", (d) => (d.type === "quote" ? "none" : "3,3"))
      .attr("marker-end", (d) => (d.type === "quote" ? "url(#arrowhead-quote)" : "url(#arrowhead)"));

    // Draw node containers
    const node = svg
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, PropagationNode>(".node")
      .data(nodesCopy as any)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(
        d3
          .drag<SVGGElement, PropagationNode>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended) as any
      )
      .on("click", (event, d) => {
        setSelectedNode(d);
      })
      .on("mouseover", function () {
        d3.select(this).select("circle.border-ring").transition().duration(150).attr("r", 25).attr("stroke", "#10b981");
      })
      .on("mouseout", function (event, d) {
        const isSelected = selectedNode?.id === d.id;
        d3.select(this)
          .select("circle.border-ring")
          .transition()
          .duration(150)
          .attr("r", 22)
          .attr("stroke", d.role === "creator" ? "#ec4899" : d.role === "quote" ? "#10b981" : "#3b82f6");
      });

    // Ring background representing status/action type
    node
      .append("circle")
      .attr("class", "border-ring")
      .attr("r", 22)
      .attr("fill", "none")
      .attr("stroke", (d) => (d.role === "creator" ? "#ec4899" : d.role === "quote" ? "#10b981" : "#3b82f6"))
      .attr("stroke-width", 2.5);

    // Main image circle filled with the pattern
    node
      .append("circle")
      .attr("r", 20)
      .attr("fill", (d) => `url(#avatar-${d.id})`);

    // Add mini badge representing depth level or role
    node
      .append("circle")
      .attr("cx", 15)
      .attr("cy", -15)
      .attr("r", 7)
      .attr("fill", (d) => (d.role === "creator" ? "#ec4899" : d.role === "quote" ? "#10b981" : "#3b82f6"));

    node
      .append("text")
      .attr("x", 15)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("font-weight", "bold")
      .attr("fill", "#ffffff")
      .text((d) => (d.role === "creator" ? "★" : d.depth));

    // Label username text below the node
    node
      .append("text")
      .attr("dy", 34)
      .attr("text-anchor", "middle")
      .attr("font-family", "Inter, sans-serif")
      .attr("font-size", "10px")
      .attr("fill", "#9ca3af")
      .text((d) => (d.label.length > 12 ? d.label.slice(0, 10) + "..." : d.label));

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[500px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-display">Simulating wave reflections...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[500px] border border-destructive/20 rounded-2xl bg-destructive/5">
        <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
        <h4 className="text-lg font-bold font-display text-foreground mb-1">Graph Failed to Render</h4>
        <p className="text-muted-foreground text-sm max-w-sm mb-4">
          Could not load the content spread tree or database nodes for this wave.
        </p>
        {onClose && (
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors">
            Close Canvas
          </button>
        )}
      </div>
    );
  }

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const hasShares = data.nodes.length > 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full text-foreground">
      {/* Interactive Visualization Screen */}
      <div className="lg:col-span-8 flex flex-col bg-card/60 backdrop-blur-md rounded-2xl border border-border overflow-hidden h-[530px]">
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-sm flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-primary" /> Dynamic Reflection Tree
            </h3>
            <p className="text-xs text-muted-foreground">Interactive wave spread visualization. Drag nodes to reshape.</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" /> Creator
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Repost
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Quote
            </span>
          </div>
        </div>

        {/* Interactive Graph Area */}
        <div ref={containerRef} className="flex-1 relative bg-black/20 overflow-hidden">
          {!hasShares ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/10">
              <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                <Share2 className="w-7 h-7 text-muted-foreground/80 animate-pulse" />
              </div>
              <h4 className="font-display font-semibold text-sm mb-1 text-foreground">Awaiting Resonance</h4>
              <p className="text-xs text-muted-foreground max-w-xs">
                This wave is completely pristine! No reposts, quote waves, or redistribution reflections have been registered yet.
              </p>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
          )}
        </div>

        {/* Node Detail Bar */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="px-5 py-3 border-t border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <img
                  src={selectedNode.avatarUrl}
                  alt={selectedNode.displayName}
                  className="w-10 h-10 rounded-full border border-border/80 object-cover"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-foreground">{selectedNode.displayName}</p>
                    <p className="text-xs text-muted-foreground">{selectedNode.label}</p>
                    {selectedNode.isVerified && <span className="text-primary text-[10px]">● Verified</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 inline text-muted-foreground" />
                    {selectedNode.role === "creator"
                      ? "Created Wave: "
                      : selectedNode.role === "quote"
                      ? "Quoted: "
                      : "Reposted: "}
                    {formatTime(selectedNode.createdAt)}
                  </p>
                </div>
              </div>

              {selectedNode.caption && (
                <div className="flex-1 max-w-md bg-black/20 border border-border/60 rounded-xl px-3 py-2 text-muted-foreground italic truncate">
                  &ldquo;{selectedNode.caption}&rdquo;
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                  selectedNode.role === "creator"
                    ? "bg-pink-500/15 border-pink-500/30 text-pink-400"
                    : selectedNode.role === "quote"
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : "bg-blue-500/15 border-blue-500/30 text-blue-400"
                }`}>
                  {selectedNode.role}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-secondary border border-border text-foreground">
                  Depth {selectedNode.depth}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Creator Analytics Panel */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        {/* Core Stats Overview */}
        <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border p-5">
          <h4 className="font-display font-semibold text-sm mb-4 flex items-center gap-1.5 border-b border-border pb-3">
            <TrendingUp className="w-4 h-4 text-primary" /> Propagation Metrics
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Reflections</p>
              <h5 className="font-display font-bold text-2xl text-foreground">{data.analytics.totalShares}</h5>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {data.analytics.repostsCount} rep | {data.analytics.quotesCount} quote
              </p>
            </div>

            <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 text-center">
              <p className="text-xs text-muted-foreground mb-1">Spread Depth</p>
              <h5 className="font-display font-bold text-2xl text-foreground">{data.analytics.spreadDepth}</h5>
              <p className="text-[10px] text-muted-foreground mt-0.5">Reflective steps</p>
            </div>
          </div>

          <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60 mt-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Mean Propagation Delay</p>
            <h5 className="font-display font-bold text-xl text-foreground">
              {data.analytics.spreadSpeedMinutes > 0
                ? `${data.analytics.spreadSpeedMinutes} mins`
                : "Instantaneous"}
            </h5>
            <p className="text-[10px] text-muted-foreground mt-0.5">Average time until secondary share</p>
          </div>
        </div>

        {/* Top Amplifiers Section */}
        <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border p-5 flex-1 min-h-[160px]">
          <h4 className="font-display font-semibold text-sm mb-3.5 flex items-center gap-1.5 border-b border-border pb-2.5">
            <Award className="w-4 h-4 text-accent" /> Key Resonance Amplifiers
          </h4>

          {data.analytics.topAmplifiers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[120px] text-center text-muted-foreground">
              <p className="text-xs">No downstream amplification detected.</p>
              <p className="text-[10px] max-w-[200px] mt-1">
                Downstream shares happen when other users share a repost of this wave.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.analytics.topAmplifiers.map((amp, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/40">
                  <div className="flex items-center gap-2.5">
                    <img src={amp.avatarUrl} alt={amp.displayName} className="w-8 h-8 rounded-full border border-border/80 object-cover" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{amp.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">@{amp.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-primary">+{amp.downstreamCount} waves</p>
                    <p className="text-[9px] text-muted-foreground">downstream reach</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Longest Influence Path */}
        <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border p-5">
          <h4 className="font-display font-semibold text-sm mb-3.5 flex items-center gap-1.5 border-b border-border pb-2.5">
            <Compass className="w-4 h-4 text-emerald-400" /> Maximum Influence Path
          </h4>

          {data.analytics.longestChain.length <= 1 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No active propagation trails.</p>
          ) : (
            <div className="relative">
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs font-semibold text-muted-foreground">
                {data.analytics.longestChain.map((username, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 inline" />}
                    <span className={`px-2 py-1 rounded-lg ${
                      idx === 0 
                        ? "bg-pink-500/15 border border-pink-500/30 text-pink-400" 
                        : idx === data.analytics.longestChain.length - 1
                        ? "bg-primary/20 border border-primary/40 text-primary-foreground"
                        : "bg-muted/60 border border-border text-foreground"
                    }`}>
                      {username}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                Represents the deepest chain of secondary reflections, showing the longest path this specific wave travelled across user interactions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
