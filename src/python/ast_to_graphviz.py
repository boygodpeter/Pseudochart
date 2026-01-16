#!/usr/bin/env python3
# -*- coding: utf-8 -*-


import ast      # Python 抽象語法樹模組，用於解析程式碼結構
import json     # JSON 模組，用於輸出結果
import sys      # 系統模組，用於讀取標準輸入輸出
import io       # 輸入輸出模組
import codecs   # 編碼解碼模組，處理 UTF-8 編碼
from graphviz import Digraph  # Graphviz 圖形生成庫

class FlowChartVisitor(ast.NodeVisitor):    
    
    def __init__(self):
        
        # 建立有向圖 SVG
        self.graph = Digraph('flowchart', format='svg')
        
        # 設定圖形屬性
        self.graph.attr(rankdir='TB', bgcolor='transparent', nodesep='0.5', ranksep='0.5')
        
        # 設定節點預設屬性
        self.graph.attr('node', fontname='Arial', fontsize='12', fontcolor='black')
        
        # 設定邊（連線）預設屬性
        self.graph.attr('edge', fontname='Arial', fontsize='10', color='#333333')
        
        # 節點計數器，用於生成唯一的節點 ID
        self.node_counter = 0
        
        # 當前處理的節點，用於連接流程
        self.current_node = None
        
        # 程式碼行號到節點的映射字典
        self.line_to_node = {}
        
        # 節點到程式碼行號的映射字典
        self.node_to_lines = {}
        
        # 迴圈堆疊，用於處理巢狀迴圈和 break/continue
        self.loop_stack = []
        
    def create_node(self, label, shape='box', color='lightblue'):
        # 生成唯一的節點 ID
        node_id = f'node_{self.node_counter}'
        self.node_counter += 1
        
        # 根據不同形狀建立節點
        if shape == 'box':
            # 方框：一般敘述（賦值、函式呼叫等）
            self.graph.node(node_id, label, shape='box', style='filled,rounded', 
                          fillcolor=color, color='black')
        elif shape == 'diamond':
            # 菱形：條件判斷（if、while、for）
            self.graph.node(node_id, label, shape='diamond', style='filled', 
                          fillcolor=color, color='black')
        elif shape == 'ellipse':
            # 橢圓形：開始/結束節點
            self.graph.node(node_id, label, shape='ellipse', style='filled', 
                          fillcolor=color, color='black')
        elif shape == 'parallelogram':
            # 平行四邊形：輸入/輸出（input/print）
            self.graph.node(node_id, label, shape='parallelogram', style='filled', 
                          fillcolor=color, color='black')
        
        return node_id
    
    def add_line_mapping(self, node_id, line_numbers):
        """
        添加程式碼行號與節點的對應關係
        
        參數：
            node_id: 節點 ID
            line_numbers: 程式碼行號（可以是整數或列表）
        """
        # 如果是單一行號，轉換成列表
        if isinstance(line_numbers, int):
            line_numbers = [line_numbers]
        
        # 建立行號到節點的映射
        for line in line_numbers:
            self.line_to_node[line] = node_id
        
        # 建立節點到行號的映射
        if node_id not in self.node_to_lines:
            self.node_to_lines[node_id] = []
        self.node_to_lines[node_id].extend(line_numbers)
    
    def connect(self, from_node, to_node, label=None):
        """
        建立兩個節點之間的連線
        
        參數：
            from_node: 起始節點 ID
            to_node: 目標節點 ID
            label: 連線標籤（可選，如 'True'、'False'）
        """
        if from_node and to_node:
            if label:
                self.graph.edge(from_node, to_node, label=label)
            else:
                self.graph.edge(from_node, to_node)
    
    def visit_Module(self, node):
        # 建立開始節點
        start_node = self.create_node('Start', shape='ellipse', color='lightgreen')
        self.current_node = start_node
        
        # 記錄最後一個節點，用於連接到結束節點
        last_valid_node = start_node
        
        # 遍歷模組中的所有語句
        for stmt in node.body:
            before_visit = self.current_node
            self.visit(stmt)
            
            # 如果訪問後 current_node 不是 None，更新 last_valid_node
            if self.current_node:
                last_valid_node = self.current_node
            else:
                # 如果 current_node 變成 None（例如 return 後），
                # 恢復 before_visit 以繼續主流程
                self.current_node = before_visit
        
        # 建立結束節點
        end_node = self.create_node('End', shape='ellipse', color='salmon')
        
        # 決定要連接到結束節點的節點
        if self.current_node:
            connect_node = self.current_node
        else:
            connect_node = last_valid_node
            
        # 檢查是否為迴圈節點，需要加上 "Done" 標籤
        if connect_node in self.node_to_lines:
            is_loop_node = False
            # 檢查節點是否為迴圈節點（菱形且標籤包含 for 或 while）
            for body_line in self.graph.body:
                if f'"{connect_node}"' in body_line and 'shape=diamond' in body_line:
                    for label_line in self.graph.body:
                        if f'"{connect_node}"' in label_line and 'label=' in label_line:
                            if 'for ' in label_line or 'while ' in label_line:
                                is_loop_node = True
                                break
                    break
            
            # 如果是迴圈節點，使用 "Done" 標籤連接
            if is_loop_node:
                self.connect(connect_node, end_node, 'Done')
            else:
                self.connect(connect_node, end_node)
        else:
            self.connect(connect_node, end_node)
    
    def visit_FunctionDef(self, node):
        """
        訪問函式定義節點
        處理 def function_name(parameters): 語句
        """
        # 取得函式參數列表
        params = ', '.join(arg.arg for arg in node.args.args)
        func_label = f'def {node.name}({params})'
        
        # 建立函式定義節點（淺黃色方框）
        func_node = self.create_node(func_label, shape='box', color='lightyellow')
        
        # 只有在不在其他函式內部時才連接到主流程
        if not hasattr(self, 'in_function_def') or not self.in_function_def:
            self.connect(self.current_node, func_node)
        
        # 添加行號映射
        self.add_line_mapping(func_node, node.lineno)
        
        # 保存當前流程狀態
        saved_current = func_node
        saved_in_function = getattr(self, 'in_function_def', False)
        
        # 標記正在函式內部
        self.in_function_def = True
        self.current_node = func_node
        
        # 訪問函式主體
        for stmt in node.body:
            self.visit(stmt)
        
        # 恢復狀態
        self.in_function_def = saved_in_function
        
        # 函式定義後，繼續主流程
        if not self.in_function_def:
            self.current_node = saved_current
        else:
            self.current_node = None
    
    def visit_Assign(self, node):
        """
        訪問賦值語句節點
        處理 variable = value 語句
        """
        # 收集所有目標變數名稱
        targets = []
        for target in node.targets:
            if isinstance(target, ast.Name):
                # 單一變數：x = 5
                targets.append(target.id)
            elif isinstance(target, ast.Tuple):
                # 元組拆包：x, y = 1, 2
                targets.extend([elt.id for elt in target.elts if isinstance(elt, ast.Name)])
        
        # 取得賦值的值
        value_str = self.get_value_string(node.value)
        assign_label = f'{", ".join(targets)} = {value_str}'
        
        # 建立賦值節點（淺藍色方框）
        assign_node = self.create_node(assign_label, shape='box')
        
        # 連接到當前流程
        self.connect(self.current_node, assign_node)
        self.add_line_mapping(assign_node, node.lineno)
        self.current_node = assign_node
    
    def visit_If(self, node):
        """
        訪問 if 語句節點
        處理 if-elif-else 結構
        """
        # 取得條件表達式
        condition_str = self.get_condition_string(node.test)
        
        # 建立條件節點（淺紅色菱形）
        condition_node = self.create_node(f'if {condition_str}', shape='diamond', color='lightcoral')
        
        # 連接到當前流程
        self.connect(self.current_node, condition_node)
        self.add_line_mapping(condition_node, node.lineno)
        
        # 保存分支結束節點，用於後續合併
        end_nodes = []
        
        # 處理 True 分支（if 區塊）
        if node.body:
            old_current = self.current_node
            self.current_node = None
            
            for i, stmt in enumerate(node.body):
                if i == 0:
                    # True 分支的第一個語句
                    old_current_backup = self.current_node
                    self.current_node = None
                    self.visit(stmt)
                    if self.current_node:
                        # 從條件節點連接到第一個語句，標記 'True'
                        self.connect(condition_node, self.current_node, 'True')
                else:
                    # 後續語句正常流程
                    self.visit(stmt)
            
            # 記錄 True 分支的結束節點
            if self.current_node:
                end_nodes.append(self.current_node)
        
        # 處理 False 分支（else 或 elif 區塊）
        if node.orelse:
            self.current_node = None
            
            for i, stmt in enumerate(node.orelse):
                if i == 0:
                    # False 分支的第一個語句
                    old_current_backup = self.current_node
                    self.current_node = None
                    self.visit(stmt)
                    if self.current_node:
                        # 從條件節點連接到第一個語句，標記 'False'
                        self.connect(condition_node, self.current_node, 'False')
                else:
                    # 後續語句正常流程
                    self.visit(stmt)
            
            # 記錄 False 分支的結束節點
            if self.current_node:
                end_nodes.append(self.current_node)
        else:
            # 沒有 else 分支 - False 直接繼續到下一個語句
            end_nodes.append(condition_node)
        
        # 設定 current_node 為合併後的節點
        if end_nodes:
            self.current_node = end_nodes[0]  # 簡化的合併處理
    
    def visit_While(self, node):
        """
        訪問 while 迴圈節點
        處理 while condition: 結構
        """
        # 取得迴圈條件
        condition_str = self.get_condition_string(node.test)
        
        # 建立迴圈條件節點（淺青色菱形）
        condition_node = self.create_node(f'while {condition_str}', shape='diamond', color='lightcyan')
        
        # 連接到當前流程
        self.connect(self.current_node, condition_node)
        self.add_line_mapping(condition_node, node.lineno)
        
        # 將條件節點加入迴圈堆疊（用於 break/continue）
        self.loop_stack.append(condition_node)
        
        # 處理迴圈主體
        old_current = self.current_node
        self.current_node = None
        
        for i, stmt in enumerate(node.body):
            if i == 0:
                # 迴圈中的第一個語句
                self.current_node = None
                self.visit(stmt)
                if self.current_node:
                    # 條件為 True 時進入迴圈
                    self.connect(condition_node, self.current_node, 'True')
            else:
                # 後續語句正常流程
                self.visit(stmt)
        
        # 從迴圈主體最後連回條件節點
        if self.current_node:
            self.connect(self.current_node, condition_node)
        
        # 從迴圈堆疊移除
        self.loop_stack.pop()
        
        # 條件為 False 時繼續執行
        self.current_node = condition_node
    
    def visit_For(self, node):
        """
        訪問 for 迴圈節點
        處理 for target in iterable: 結構
        """
        # 取得迴圈變數和可迭代物件
        target_str = self.get_target_string(node.target)
        iter_str = self.get_value_string(node.iter)
        for_label = f'for {target_str} in {iter_str}'
        
        # 建立 for 迴圈節點（淺青色菱形）
        for_node = self.create_node(for_label, shape='diamond', color='lightcyan')
        
        # 連接到當前流程
        self.connect(self.current_node, for_node)
        self.add_line_mapping(for_node, node.lineno)
        
        # 將迴圈節點加入堆疊（用於 break/continue）
        self.loop_stack.append(for_node)
        
        # 處理迴圈主體
        self.current_node = for_node
        first_in_body = True
        last_body_node = None
        
        # 訪問迴圈主體中的每個語句
        for i, stmt in enumerate(node.body):
            # 第一個語句需要從 for_node 連接
            if first_in_body and self.current_node == for_node:
                self.visit(stmt)
                if self.current_node and self.current_node != for_node:
                    # 標記 'Next item' 表示取得下一個迭代項目
                    self.connect(for_node, self.current_node, 'Next item')
                    first_in_body = False
            else:
                # 後續語句正常流程
                self.visit(stmt)
            
            # 追蹤最後一個節點
            if self.current_node:
                last_body_node = self.current_node
        
        # 從迴圈主體最後連回 for 節點
        if last_body_node and last_body_node != for_node:
            self.connect(last_body_node, for_node)
        
        # 從迴圈堆疊移除
        self.loop_stack.pop()
        
        # 設定 current_node 為 for_node，以便下個語句用 "Done" 連接
        self.current_node = for_node
    
    def visit_Return(self, node):
        """
        訪問 return 語句節點
        處理函式返回
        """
        # 建立 return 標籤
        if node.value:
            value_str = self.get_value_string(node.value)
            return_label = f'return {value_str}'
        else:
            return_label = 'return'
        
        # 建立 return 節點（淺粉色方框）
        return_node = self.create_node(return_label, shape='box', color='lightpink')
        
        # 連接到當前流程
        self.connect(self.current_node, return_node)
        self.add_line_mapping(return_node, node.lineno)
        
        # return 結束當前分支，設為 None
        self.current_node = None
    
    def visit_Expr(self, node):
        """
        訪問表達式語句節點
        主要處理獨立的函式呼叫
        """
        if isinstance(node.value, ast.Call):
            # 如果是函式呼叫，委派給 visit_Call 處理
            self.visit_Call(node.value, node.lineno)
    
    def visit_Call(self, node, lineno):
        """
        訪問函式呼叫節點
        處理 function(arguments) 語句
        """
        # 取得函式名稱
        func_name = self.get_func_name(node.func)
        
        # 取得參數列表
        args_str = ', '.join(self.get_value_string(arg) for arg in node.args)
        call_label = f'{func_name}({args_str})'
        
        # 特殊處理 input/print（使用平行四邊形）
        if func_name in ['input', 'print']:
            shape = 'parallelogram'
            color = 'lightblue' if func_name == 'input' else 'lightgray'
        else:
            # 一般函式呼叫（使用方框）
            shape = 'box'
            color = 'lavender'
        
        # 建立函式呼叫節點
        call_node = self.create_node(call_label, shape=shape, color=color)
        
        # 連接到當前流程
        self.connect(self.current_node, call_node)
        self.add_line_mapping(call_node, lineno)
        self.current_node = call_node
    
    def visit_Break(self, node):
        """
        訪問 break 語句節點
        跳出最內層迴圈
        """
        # 建立 break 節點（橘色方框）
        break_node = self.create_node('break', shape='box', color='orange')
        
        # 連接到當前流程
        self.connect(self.current_node, break_node)
        self.add_line_mapping(break_node, node.lineno)
        
        # break 結束當前分支
        self.current_node = None
    
    def visit_Continue(self, node):
        """
        訪問 continue 語句節點
        跳到最內層迴圈的開始
        """
        # 建立 continue 節點（橘色方框）
        continue_node = self.create_node('continue', shape='box', color='orange')
        
        # 連接到當前流程
        self.connect(self.current_node, continue_node)
        self.add_line_mapping(continue_node, node.lineno)
        
        # 連回最內層的迴圈節點
        if self.loop_stack:
            self.connect(continue_node, self.loop_stack[-1])
        
        # continue 結束當前分支
        self.current_node = None
    
    def get_func_name(self, node):
        """
        從 AST 節點取得函式名稱
        
        處理：
        - 簡單函式名：func()
        - 方法呼叫：obj.method()
        """
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            # 處理 obj.method 形式
            return f'{self.get_value_string(node.value)}.{node.attr}'
        return 'function'
    
    def get_target_string(self, node):
        """
        從 AST 節點取得賦值目標的字串表示
        
        處理：
        - 單一變數：x
        - 元組拆包：(x, y)
        """
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Tuple):
            # 處理元組拆包
            return f'({", ".join(elt.id for elt in node.elts if isinstance(elt, ast.Name))})'
        return 'target'
    
    def get_value_string(self, node):
        """
        將 AST 節點轉換成可讀的字串表示
        這是一個遞迴函式，處理各種值類型
        """
        if isinstance(node, ast.Constant):
            # 常數值（數字、字串等）
            return repr(node.value)
        elif isinstance(node, ast.Name):
            # 變數名稱
            return node.id
        elif isinstance(node, ast.List):
            # 列表：[1, 2, 3]
            return f'[{", ".join(self.get_value_string(elt) for elt in node.elts)}]'
        elif isinstance(node, ast.Tuple):
            # 元組：(1, 2, 3)
            return f'({", ".join(self.get_value_string(elt) for elt in node.elts)})'
        elif isinstance(node, ast.Call):
            # 函式呼叫：func(args)
            func_name = self.get_func_name(node.func)
            args = ', '.join(self.get_value_string(arg) for arg in node.args)
            return f'{func_name}({args})'
        elif isinstance(node, ast.BinOp):
            # 二元運算：a + b
            left = self.get_value_string(node.left)
            right = self.get_value_string(node.right)
            op = self.get_op_string(node.op)
            return f'{left} {op} {right}'
        elif isinstance(node, ast.Compare):
            # 比較運算：a > b
            return self.get_condition_string(node)
        elif isinstance(node, ast.Subscript):
            # 索引操作：list[index]
            value = self.get_value_string(node.value)
            index = self.get_value_string(node.slice)
            return f'{value}[{index}]'
        # 無法識別的節點類型
        return '...'
    
    def get_condition_string(self, node):
        """
        將條件表達式轉換成字串
        
        處理：
        - 比較運算：x > 5
        - 布林運算：x and y
        - 否定運算：not x
        """
        if isinstance(node, ast.Compare):
            # 比較運算
            left = self.get_value_string(node.left)
            ops = [self.get_op_string(op) for op in node.ops]
            comparators = [self.get_value_string(comp) for comp in node.comparators]
            parts = [left]
            # 組合成完整的比較表達式
            for op, comp in zip(ops, comparators):
                parts.extend([op, comp])
            return ' '.join(parts)
        elif isinstance(node, ast.BoolOp):
            # 布林運算（and/or）
            op = 'and' if isinstance(node.op, ast.And) else 'or'
            values = [self.get_condition_string(v) for v in node.values]
            return f' {op} '.join(values)
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            # 否定運算（not）
            return f'not {self.get_condition_string(node.operand)}'
        else:
            # 其他情況直接轉換成值字串
            return self.get_value_string(node)
    
    def get_op_string(self, op):
        """
        將運算符 AST 節點轉換成對應的符號字串
        """
        op_map = {
            # 算術運算符
            ast.Add: '+',        # 加法
            ast.Sub: '-',        # 減法
            ast.Mult: '*',       # 乘法
            ast.Div: '/',        # 除法
            ast.Mod: '%',        # 取餘數
            ast.Pow: '**',       # 次方
            ast.FloorDiv: '//',  # 整數除法
            
            # 比較運算符
            ast.Eq: '==',        # 等於
            ast.NotEq: '!=',     # 不等於
            ast.Lt: '<',         # 小於
            ast.LtE: '<=',       # 小於等於
            ast.Gt: '>',         # 大於
            ast.GtE: '>=',       # 大於等於
            ast.Is: 'is',        # is 運算符
            ast.IsNot: 'is not', # is not 運算符
            ast.In: 'in',        # in 運算符
            ast.NotIn: 'not in'  # not in 運算符
        }
        return op_map.get(type(op), '?')

def main():
    
    
    import sys
    import codecs
    
    
    if sys.platform == 'win32':
        sys.stdin = codecs.getreader('utf-8')(sys.stdin.buffer)
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
    
    #讀取 Python 程式碼
    python_code = sys.stdin.read()
    
    # 1 解析 Python 程式碼變成 AST 結構
    tree = ast.parse(python_code)
        
    # 2 建立流程圖訪問者並遍歷產生的 AST 結構
    visitor = FlowChartVisitor()
    visitor.visit(tree)
        
    # 3 生成 SVG 格式的流程圖
    svg_data = visitor.graph.pipe(format='svg')
    svg_content = svg_data.decode('utf-8', errors='replace')
        
    # 4 準備輸出結果
    result = {
           'svg': svg_content,                    # SVG 流程圖內容
            'lineToNode': visitor.line_to_node,    # 行號到節點的映射
            'nodeToLine': visitor.node_to_lines    # 節點到行號的映射
        }
        
        # 步驟 5：輸出 JSON（ensure_ascii=False 確保 Unicode 字元正確顯示）
    print(json.dumps(result, ensure_ascii=False))
        
    #except Exception as e:
        # 錯誤處理：輸出錯誤訊息到標準錯誤
        #error_msg = str(e).encode('utf-8', errors='replace').decode('utf-8')
        #print(json.dumps({'error': error_msg}, ensure_ascii=False), file=sys.stderr)
        #sys.exit(1)

# 程式進入點
if __name__ == '__main__':
    main()