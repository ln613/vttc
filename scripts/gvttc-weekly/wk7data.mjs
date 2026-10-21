// Week 7 fixtures, transcribed from the six paper scorecards (14 Oct 2026).
// `table` is the handwritten 台 number on the sheet; home = the A/B/C side.
// Every sheet followed the printed A-X, B-Y, C-Z… order, so no `pairs`.
// Games are [home, away]; queries are [match, game, note], both 1-based.
export const WEEK = 7
export const DATE_LABEL = '14 October 2026'

export const fixtures = [
  {
    table: 1,
    home: { name: 'Ever Green', players: ['Danny Jiang', 'Brian T.H. Wong', 'Osama Tadros'] },
    away: { name: 'Tri Froce', players: ['Amanda Zhu', 'Yiwen Pan', 'Jinyuan Zhang'] },
    games: [
      [[11,4],[11,7],[8,11],[11,7]],
      [[11,6],[11,7],[11,4]],
      [[11,7],[9,11],[6,11],[8,11]],
      [[11,7],[11,8],[12,10]],
      [[11,3],[13,11],[11,2]],
      [[11,8],[11,9],[11,1]],
      [[11,6],[8,11],[11,6],[11,9]],
      [[11,6],[11,6],[11,6]],
      [[11,4],[11,9],[9,11],[9,11],[14,12]],
    ],
    queries: [],
    final: [8, 1],
  },
  {
    table: 2,
    home: { name: 'Master Pong', players: ['Cheong Lam He', 'Weizhong Ji', 'Hou Fong Chang'] },
    away: { name: 'Spin Power', players: ['Yubo Duan', 'Chuanzhi Zhao', 'Hamid Gharachamani'] },
    games: [
      [[11,8],[11,8],[12,10]],
      [[11,4],[11,8],[11,7]],
      [[8,11],[7,11],[9,11]],
      [[6,11],[11,8],[11,3],[11,3]],
      [[7,11],[11,7],[11,7],[11,6]],
      [[11,13],[12,10],[6,11],[4,11]],
      [[11,7],[11,7],[11,5]],
      [[11,7],[11,7],[11,7]],
      [[7,11],[9,11],[9,11]],
    ],
    queries: [],
    final: [6, 3],
  },
  {
    table: 3,
    home: { name: '金刚葫芦队', players: ['Sean Xiang Zhu', 'Alexander Lu', 'Steven G.Q. Chen'] },
    away: { name: 'Happy', players: ['Brian Liu', 'Yau Man Cheng', 'Eric Cheung'] },
    games: [
      [[11,3],[11,9],[11,4]],
      [[8,11],[11,9],[8,11],[4,11]],
      [[10,12],[11,9],[3,11],[7,11]],
      [[6,11],[11,5],[9,11],[11,2],[11,9]],
      [[11,13],[11,8],[6,11],[6,11]],
      [[11,6],[11,7],[11,8]],
      [[11,8],[11,9],[11,4]],
      [[11,6],[11,4],[11,6]],
      [[9,11],[5,11],[11,8],[11,8],[11,9]],
    ],
    queries: [],
    final: [6, 3],
  },
  {
    table: 4,
    home: { name: 'Team Karami', players: ['Frank Cao', 'Yi Xin Wang', 'James J. Suo'] },
    away: { name: 'White Rock Elite', players: ['Nick Zhou', 'Xuexin Xie', 'William Liu'] },
    games: [
      [[11,8],[12,14],[5,11],[11,5],[11,7]],
      [[8,11],[5,11],[9,11]],
      [[8,11],[7,11],[13,11],[11,7],[13,11]],
      [[11,7],[12,10],[11,6]],
      [[11,4],[11,7],[11,8]],
      [[7,11],[6,11],[9,11]],
      [[10,12],[8,11],[11,5],[2,11]],
      [[5,11],[11,7],[7,11],[8,11]],
      [[11,9],[6,11],[3,11],[6,11]],
    ],
    queries: [],
    final: [4, 5],
  },
  {
    table: 5,
    home: { name: 'Team Infinite', players: ['David Yifeng Xu', 'Roy Huang', 'John Zuo'] },
    away: { name: 'Xero', players: ['Jimmy Chen', 'Adrian Nusalim', 'Alan Ong'] },
    games: [
      [[11,5],[11,7],[11,3]],
      [[11,7],[7,11],[11,6],[9,11],[3,11]],
      [[11,8],[11,8],[11,3]],
      [[11,9],[11,7],[11,8]],
      [[11,6],[11,5],[11,8]],
      [[12,10],[11,8],[9,11],[11,7]],
      [[11,1],[11,5],[11,5]],
      [[11,5],[11,4],[11,6]],
      [[3,11],[7,11],[6,11]],
    ],
    queries: [],
    final: [7, 2],
  },
  {
    table: 6,
    home: { name: 'Fin', players: ['Joson Hsu', 'Lester Lee', 'Nan Li'] },
    away: { name: 'Burnaby North', players: ['Hao Kun Lei', 'Yue Fang', 'Jingxi Gao'] },
    games: [
      [[12,10],[11,8],[11,7]],
      [[11,5],[11,9],[11,8]],
      [[11,7],[11,8],[11,2]],
      [[12,10],[7,11],[11,13],[12,10],[8,11]],
      [[11,6],[11,2],[11,2]],
      [[12,10],[11,9],[7,11],[11,5]],
      [[15,13],[11,7],[11,7]],
      [[11,9],[11,4],[11,5]],
      [[11,7],[6,11],[12,10],[11,8]],
    ],
    queries: [],
    final: [8, 1],
  },
]

// All lineup names and unclear scores are confirmed (2026-10-15); nothing is marked.
export const inferred = {}
