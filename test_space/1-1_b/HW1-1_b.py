import numpy as np
from matplotlib import pyplot as plt 

# input x, y values
x_path = "x.txt"
x_data = np.loadtxt(x_path)
y_path = "y1.txt"
y_data = np.loadtxt(y_path)


#########################################
#                                       #
#       Demostration picture            #
#                                       #
#########################################

#y1 = w0 + w1(x^1) + w2(x^2)
#normal equations: w =(X^T @ X)^{-1} @ X^T @ y

#       [1  (x1)  (x1)^2  ]
# X  =  [1  (x2)  (x2)^2  ]
#       [.................]
#       [         ]
#       [         ]

#########################################
##           Compute w_matrix          ##
#########################################

def create_polynomial_matrix(x, degree):
    """生成多項式特徵矩陣，每列為 [1, x, x², ..., x^degree]"""
    # 動態生成矩陣：每一列為 [1, x, x², ..., x^degree]
    return np.column_stack([x**d for d in range(degree + 1)])

def compute_w(_x_data, _y_data, m_order):
    x_matrix = create_polynomial_matrix(_x_data, m_order)
    y_matrix = np.vstack(_y_data)
    # print("X_matrix:\n", x_matrix)
    # print("Y_matrix:\n", y_matrix)

    # normal equations: w =(X^T @ X)^{-1} @ X^T @ y
    x_matrix_transpose = x_matrix.T
    w_matrix = np.linalg.inv(x_matrix_transpose @ x_matrix) @ x_matrix_transpose @ y_matrix
    return x_matrix, y_matrix, w_matrix

# w_matrix = compute_w(x_data, y_data, 2)
# print("w_matrix:\n", w_matrix)

#########################################
##           Make picture              ##
#########################################

## initial output picture
plt.xlabel('x-axis')
plt.ylabel('y-axis')
plt.grid(True)

# Scatter picture
plt.scatter(x_data, y_data)

# define function
## plot the function: y = w0 + w1(x) + w2 (x^2)       
#     [1  (x1)  (x1)^2  ]   w0 
# y = [1  (x2)  (x2)^2  ] [ w1 ]
#     [.................]   w2 
#     [         ]
#     [         ]
#
# y = X @ w

def compute_predict_Y(
        _w_matrix, m_order,
        _x_i_predict = np.linspace(0, 3500, 1000)):
    x_predict_matrix = create_polynomial_matrix(_x_i_predict, m_order)
    y_predict_matrix = x_predict_matrix @ _w_matrix
    return y_predict_matrix, x_predict_matrix

# E = 1/n || y - Xw ||^2
def compute_sum_of_square_error(y_matrix, x_matrix, w_matrix):
    tmp_matrix = y_matrix - x_matrix @ w_matrix
    error_sum = 0
    mt_len = len(tmp_matrix)
    for i in range(0, mt_len):
        error_sum += (tmp_matrix[i])**2
    return error_sum / mt_len

text = "average sum of square error:\n"
for i in range(3, 13):
    x_matrix, y_matrix, w_matrix = compute_w(x_data, y_data, i)
    y_predict_matrix, x_predict_matrix = compute_predict_Y(w_matrix, i, np.linspace(0, 3500, 1000))
    tmp_error = compute_sum_of_square_error(y_matrix, x_matrix, w_matrix)
    # print(f"m order = {i}, sum of square error:", tmp_error)
    text += f"m order = {i}, sum of square error:" + str(tmp_error) + '\n'

print(text)
with open("output_of_HW1-1_b.txt", 'w', encoding='utf-8') as output_file:
    output_file.write(text)

x_matrix, y_matrix, w_matrix = compute_w(x_data, y_data, 9)
y_predict_matrix, x_predict_matrix = compute_predict_Y(w_matrix, 9, np.linspace(0, 3500, 1000))
plt.plot(np.linspace(0, 3500, 1000), y_predict_matrix, label = "9 exp", color = "red")
plt.suptitle("fitting curve of m order = 9")
plt.savefig("fig_of_HW1-1_b.png", dpi=300)
# plt.show()
plt.close()